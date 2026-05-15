export const SYSTEM_FEES = {
  DEALER_PACKAGES: [
    { id: 'standard', name: 'Gói 30 ngày', price_vnd: 500000, duration_days: 30 },
    { id: 'premium', name: 'Gói 60 ngày', price_vnd: 900000, duration_days: 60, discount: '10%' },
    { id: 'annual', name: 'Gói 1 năm', price_vnd: 5000000, duration_days: 365, discount: '16%' }
  ],
  BOOST_PACKAGES: [
    { id: 'boost_3d', name: 'Gói Ghim 3 ngày', price_vnd: 19000, duration_days: 3 },
    { id: 'boost_7d', name: 'Gói Ghim 7 ngày', price_vnd: 39000, duration_days: 7, discount: '17%' },
    { id: 'boost_30d', name: 'Gói Ghim 30 ngày', price_vnd: 149000, duration_days: 30, discount: '21%' }
  ]
};
