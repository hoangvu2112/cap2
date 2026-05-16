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
  // Hiß╗çn tß║íi c├│ thß╗â split nß║┐u cß║ºn, nh╞░ng theo thiß║┐t kß║┐ mß╗¢i th├¼ mß╗ùi b├¬n c├│ thß╗â trß║ú mß╗⌐c ph├¡ n├áy 
  // hoß║╖c mß╗ùi b├¬n trß║ú mß╗Öt nß╗¡a. ─Éß╗â an to├án, t├┤i vß║½n giß╗» split 70-30 hoß║╖c 50-50 tuß╗│ logic c┼⌐, 
  // Tuy nhi├¬n theo luß╗ông v├¡ N├┤ng xu th├¼ hoa hß╗ông l├á ph├¡ cho Mß╗ÿT lß║ºn giao dß╗ïch. 
  // Giß║ú sß╗¡ farmer trß║ú fee, buyer c┼⌐ng trß║ú fee, n├¬n h├ám split c├│ thß╗â kh├┤ng cß║ºn thiß║┐t nß╗»a nß║┐u mß╗ùi ng╞░ß╗¥i chß╗ïu 1 khoß║ún ph├¡.
  // Nh╞░ng ─æß╗â kh├┤ng break c├íc phß║ºn kh├íc, ta vß║½n giß╗» split n├áy.
  const farmerFee = Math.round(totalFee * 0.7);
  const dealerFee = totalFee - farmerFee;

  return { farmerFee, dealerFee };
}
