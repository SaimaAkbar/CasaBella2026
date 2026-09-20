import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { Role, UnitType } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import {
  RejectBankTransferDto,
  SubmitBankTransferDto,
  VerifyBankTransferDto,
} from './dto/bank-transfer.dto';
import { OnlineBookingCheckoutDto } from './dto/online-booking-checkout.dto';
import { OnlineBookingQuoteDto } from './dto/online-booking-quote.dto';
import { PublicAvailabilityDto } from './dto/public-availability.dto';
import { QueryOnlineBookingsDto } from './dto/query-online-bookings.dto';
import { OnlineBookingsService } from './online-bookings.service';

const RECEIPT_UPLOAD_DIR = join(process.cwd(), 'uploads', 'bank-receipts');
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const RECEIPT_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
]);
const RECEIPT_EXT = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

function ensureReceiptDir() {
  if (!existsSync(RECEIPT_UPLOAD_DIR)) {
    mkdirSync(RECEIPT_UPLOAD_DIR, { recursive: true });
  }
}

async function parseSubmitBankTransferDto(
  body: Record<string, string>,
): Promise<SubmitBankTransferDto> {
  const dto = plainToInstance(SubmitBankTransferDto, {
    bookingNumber: body.bookingNumber,
    paymentSelection: body.paymentSelection,
    submittedAmount: Number(body.submittedAmount),
    transferDate: body.transferDate,
    transactionReference: body.transactionReference,
    senderName: body.senderName,
    senderBank: body.senderBank,
  });
  const errors = await validate(dto);
  if (errors.length) {
    const message = errors
      .flatMap((e) => Object.values(e.constraints ?? {}))
      .join('; ');
    throw new BadRequestException(message || 'Invalid payment submission');
  }
  return dto;
}

/** Public website endpoints — no JWT. */
@Controller('public')
export class PublicOnlineBookingsController {
  constructor(private readonly onlineBookings: OnlineBookingsService) {}

  @Get('units')
  listUnits(
    @Query('unitType') unitType?: UnitType,
    @Query('checkInDateTime') checkInDateTime?: string,
    @Query('checkOutDateTime') checkOutDateTime?: string,
  ) {
    const type =
      unitType === UnitType.ROOM || unitType === UnitType.APARTMENT
        ? unitType
        : undefined;
    return this.onlineBookings.listPublicUnits(
      type,
      checkInDateTime,
      checkOutDateTime,
    );
  }

  @Get('units/:id/occupied-dates')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  occupiedDates(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.onlineBookings.getPublicOccupiedDates(id, from, to);
  }

  @Get('units/:id')
  getUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('checkInDateTime') checkInDateTime?: string,
    @Query('checkOutDateTime') checkOutDateTime?: string,
  ) {
    return this.onlineBookings.getPublicUnit(
      id,
      checkInDateTime,
      checkOutDateTime,
    );
  }

  @Post('availability')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  checkAvailability(@Body() dto: PublicAvailabilityDto) {
    return this.onlineBookings.checkAvailability(dto);
  }

  @Get('online-bookings/payment-config')
  paymentConfig() {
    return this.onlineBookings.getPaymentConfig();
  }

  @Get('online-bookings/:bookingNumber/payment')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  paymentPage(@Param('bookingNumber') bookingNumber: string) {
    return this.onlineBookings.getBankTransferPaymentPage(bookingNumber);
  }

  @Post('online-bookings/quote')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  quote(@Body() dto: OnlineBookingQuoteDto) {
    return this.onlineBookings.quote(dto);
  }

  @Post('online-bookings/checkout')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  checkout(@Body() dto: OnlineBookingCheckoutDto) {
    return this.onlineBookings.checkout(dto);
  }

  @Post('online-bookings/submit-bank-transfer')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('receipt', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureReceiptDir();
          cb(null, RECEIPT_UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: RECEIPT_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname || '').toLowerCase();
        if (!RECEIPT_EXT.has(ext) || !RECEIPT_MIME.has(file.mimetype)) {
          cb(
            new BadRequestException(
              'Receipt must be JPG, JPEG, PNG, or PDF (max 5MB).',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async submitBankTransfer(
    @Body() body: Record<string, string>,
    @UploadedFile() receipt?: Express.Multer.File,
  ) {
    const dto = await parseSubmitBankTransferDto(body);
    const receiptPath = receipt
      ? `/uploads/bank-receipts/${receipt.filename}`
      : null;
    return this.onlineBookings.submitBankTransfer(dto, receiptPath);
  }

  @Get('online-bookings/:bookingNumber/status')
  status(@Param('bookingNumber') bookingNumber: string) {
    return this.onlineBookings.getPublicStatus(bookingNumber);
  }

  @Post('online-bookings/:bookingNumber/mock-complete')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  mockComplete(@Param('bookingNumber') bookingNumber: string) {
    return this.onlineBookings.mockComplete(bookingNumber);
  }
}

/** Safepay payment webhooks — no JWT; signature verified in service. */
@Controller('payments/safepay')
export class SafepayWebhookController {
  constructor(private readonly onlineBookings: OnlineBookingsService) {}

  @Post('webhook')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.onlineBookings.handleSafepayWebhook(rawBody, headers);
  }
}

/** Staff POS endpoints for online bookings. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.RECEPTIONIST)
@Controller('online-bookings')
export class OnlineBookingsAdminController {
  constructor(private readonly onlineBookings: OnlineBookingsService) {}

  @Get()
  findAll(@Query() query: QueryOnlineBookingsDto) {
    return this.onlineBookings.findAllAdmin(query);
  }

  @Get('summary')
  summary() {
    return this.onlineBookings.getSummaryAdmin();
  }

  /** Declared before :id so "payments" is never parsed as a booking UUID. */
  @Post('payments/:onlinePaymentId/verify')
  verifyBankTransfer(
    @Param('onlinePaymentId', ParseUUIDPipe) onlinePaymentId: string,
    @Body() dto: VerifyBankTransferDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.onlineBookings.verifyBankTransfer(onlinePaymentId, user, dto);
  }

  @Post('payments/:onlinePaymentId/reject')
  rejectBankTransfer(
    @Param('onlinePaymentId', ParseUUIDPipe) onlinePaymentId: string,
    @Body() dto: RejectBankTransferDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.onlineBookings.rejectBankTransfer(onlinePaymentId, user, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.onlineBookings.findOneAdmin(id);
  }
}
