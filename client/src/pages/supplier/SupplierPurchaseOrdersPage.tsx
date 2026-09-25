import React from 'react';
import { Navigate } from 'react-router-dom';

export const SupplierPurchaseOrdersPage: React.FC = () => {
  return <Navigate to="/supplier/products" replace />;
};

export default SupplierPurchaseOrdersPage;
