export function calculateTotalFee(amount) {
  // < 20tr: 1% (Min 20k)
  // 20tr - 100tr: 0.5%
  // > 100tr: 0.2% (Max 500k)
  if (amount < 20000000) {
    return Math.max(20000, Math.round(amount * 0.01));
  } else if (amount <= 100000000) {
    return Math.round(amount * 0.005);
  } else {
    return Math.min(500000, Math.round(amount * 0.002));
  }
}

export function splitFee(totalFee) {
  // Hiện tại có thể split nếu cần, nhưng theo thiết kế mới thì mỗi bên có thể trả mức phí này 
  // hoặc mỗi bên trả một nửa. Để an toàn, tôi vẫn giữ split 70-30 hoặc 50-50 tuỳ logic cũ, 
  // Tuy nhiên theo luồng ví Nông xu thì hoa hồng là phí cho MỘT lần giao dịch. 
  // Giả sử farmer trả fee, buyer cũng trả fee, nên hàm split có thể không cần thiết nữa nếu mỗi người chịu 1 khoản phí.
  // Nhưng để không break các phần khác, ta vẫn giữ split này.
  const farmerFee = Math.round(totalFee * 0.7);
  const dealerFee = totalFee - farmerFee;

  return { farmerFee, dealerFee };
}