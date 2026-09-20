export type WebsiteFacility = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  imageAlt: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WebsiteFacilityFormValues = {
  name: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  sortOrder: string;
  isActive: boolean;
};

export type WebsiteFacilityInput = {
  name: string;
  description?: string;
  imageUrl: string;
  imageAlt?: string;
  sortOrder?: number;
  isActive?: boolean;
};
