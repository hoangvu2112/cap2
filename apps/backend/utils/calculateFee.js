export function calculateTotalFee(amount) {
  if (amount < 500000) return 5000;
  if (amount < 2000000) return 15000;
  if (amount < 10000000) return 45000;
  return 80000;
}

export function splitFee(totalFee) {
  const farmerFee = Math.round(totalFee * 0.7);
  const dealerFee = totalFee - farmerFee;

  return { farmerFee, dealerFee };
}