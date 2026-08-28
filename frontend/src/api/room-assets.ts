import { apiRequest, toQueryString } from './client';
import type {
  ChangeRoomAssetConditionInput,
  RoomAsset,
  RoomAssetHistory,
  RoomAssetInput,
  RoomAssetQuery,
} from '../types/inventory';

function queryParams(query: RoomAssetQuery) {
  return toQueryString({
    propertyId: query.propertyId || undefined,
    unitId: query.unitId || undefined,
    condition: query.condition || undefined,
    isActive:
      query.isActive === '' || query.isActive === undefined
        ? undefined
        : String(query.isActive),
    search: query.search || undefined,
  });
}

export function fetchRoomAssets(
  token: string,
  query: RoomAssetQuery = {},
): Promise<RoomAsset[]> {
  return apiRequest<RoomAsset[]>(`/room-assets${queryParams(query)}`, {
    token,
  });
}

export function fetchRoomAsset(
  token: string,
  id: string,
): Promise<RoomAsset> {
  return apiRequest<RoomAsset>(`/room-assets/${id}`, { token });
}

export function createRoomAsset(
  token: string,
  payload: RoomAssetInput,
): Promise<RoomAsset> {
  return apiRequest<RoomAsset>('/room-assets', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateRoomAsset(
  token: string,
  id: string,
  payload: Partial<RoomAssetInput> & { isActive?: boolean },
): Promise<RoomAsset> {
  return apiRequest<RoomAsset>(`/room-assets/${id}`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function archiveRoomAsset(
  token: string,
  id: string,
): Promise<RoomAsset> {
  return apiRequest<RoomAsset>(`/room-assets/${id}`, {
    method: 'DELETE',
    token,
  });
}

export function changeRoomAssetCondition(
  token: string,
  id: string,
  payload: ChangeRoomAssetConditionInput,
): Promise<{ asset: RoomAsset; history: RoomAssetHistory }> {
  return apiRequest<{ asset: RoomAsset; history: RoomAssetHistory }>(
    `/room-assets/${id}/change-condition`,
    {
      method: 'POST',
      token,
      body: payload,
    },
  );
}

export function fetchRoomAssetHistory(
  token: string,
  id: string,
): Promise<RoomAssetHistory[]> {
  return apiRequest<RoomAssetHistory[]>(`/room-assets/${id}/history`, {
    token,
  });
}
