export type Property = {
  id: string;
  name: string;
  address: string;
  city: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    units: number;
  };
};

export type PropertyFormValues = {
  name: string;
  address: string;
  city: string;
  description: string;
  isActive: boolean;
};

export type PropertyInput = {
  name: string;
  address: string;
  city: string;
  description?: string;
  isActive?: boolean;
};
