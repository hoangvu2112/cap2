import { useState, useEffect } from "react";
import { Wallet as WalletIcon, CreditCard, ArrowDownRight, ArrowUpRight, History, Gift, PlusCircle } from "lucide-react";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

export default function Wallet() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [depositError, setDepositError] = useState("");
  const [depositSuccess, setDepositSuccess] = useState("");

  const fetchWallet = async () => {
    try {
      const res = await api.get("/wallet/my-wallet");
      setWallet(res.data.wallet);
      setTransactions(res.data.transactions);
    } catch (error) {
      console.error("Lỗi lấy thông tin ví", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  // Xử lý redirect từ MoMo
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const momoDeposit = urlParams.get("momo-deposit");
    const resultCode = urlParams.get("resultCode");
    const amount = urlParams.get("amount");
    const orderId = urlParams.get("orderId");
    const status = urlParams.get("status");

    if (!momoDeposit) return;

    // Xóa params khỏi URL
    window.history.replaceState({}, document.title, window.location.pathname);

    const handleMomoReturn = async () => {
      const isSuccess = resultCode === "0";

      if (isSuccess && amount && orderId) {
        // Gọi confirm để cộng tiền (vì webhook không gọi được localhost)
        try {
          await api.post("/wallet/deposit/confirm", { orderId, amount: Number(amount) });
          setDepositSuccess(`Nạp thành công ${Number(amount).toLocaleString("vi-VN")}đ vào ví!`);
          fetchWallet();
        } catch (err) {
          console.warn("[Deposit Confirm]", err?.response?.data?.error || err?.message);
          // Có thể webhook đã xử lý rồi
          setDepositSuccess("Nạp tiền thành công!");
          fetchWallet();
        }
      } else if (status === "cancel") {
        setDepositError("Bạn đã hủy giao dịch nạp tiền.");
      } else if (resultCode && resultCode !== "0") {
        setDepositError(`Giao dịch không thành công (mã ${resultCode}).`);
      }
    };

    handleMomoReturn();
  }, []);

  const handleDeposit = async () => {
    const amount = Number(depositAmount);
    if (!amount || amount < 10000) {
      setDepositError("Số tiền tối thiểu là 10,000đ");
      return;
    }

    try {
      setDepositing(true);
      setDepositError("");

      const res = await api.post("/wallet/deposit", { amount });

      if (res.data.simulated) {
        // Simulate mode: đã cộng tiền trực tiếp
        setShowDepositModal(false);
        setDepositAmount("");
        setDepositSuccess(`Nạp thành công ${amount.toLocaleString("vi-VN")}đ vào ví!`);
        fetchWallet();
      } else if (res.data.payUrl) {
        // MoMo thật: redirect đến trang thanh toán
        window.location.href = res.data.payUrl;
      } else {
        setDepositError("Không thể tạo link thanh toán. Vui lòng thử lại.");
      }
    } catch (error) {
      setDepositError(error.response?.data?.error || "Lỗi khi tạo giao dịch nạp tiền");
    } finally {
      setDepositing(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Đang tải Ví Nông Xu...</div>;

  const totalBalance = Number(wallet?.balance || 0) + Number(wallet?.bonus_balance || 0);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Thông báo thành công */}
      {depositSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
          <p className="text-emerald-700 font-medium">{depositSuccess}</p>
          <button onClick={() => setDepositSuccess("")} className="text-emerald-500 hover:text-emerald-700 font-bold">✕</button>
        </div>
      )}

      {/* Thông báo lỗi */}
      {depositError && !showDepositModal && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
          <p className="text-red-700 font-medium">{depositError}</p>
          <button onClick={() => setDepositError("")} className="text-red-500 hover:text-red-700 font-bold">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <WalletIcon className="w-8 h-8 text-primary" />
            Ví Nông Xu
          </h1>
          <p className="text-muted-foreground mt-1">Quản lý số dư và giao dịch của bạn dễ dàng.</p>
        </div>
        <button
          onClick={() => { setShowDepositModal(true); setDepositError(""); }}
          className="bg-primary text-white hover:bg-primary/90 px-6 py-2.5 rounded-xl font-medium shadow-sm hover:shadow transition-all flex items-center gap-2 w-full md:w-auto justify-center"
        >
          <PlusCircle className="w-5 h-5" />
          Nạp tiền
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-600 to-green-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-green-50 mb-2">
              <WalletIcon className="w-5 h-5" />
              <span className="font-medium">Tổng tài sản</span>
            </div>
            <div className="text-4xl font-bold tracking-tight">
              {formatCurrency(totalBalance)}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <CreditCard className="w-5 h-5 text-blue-500" />
              <span className="font-medium">Tiền Nạp (Balance)</span>
            </div>
            <div className="text-3xl font-bold text-foreground">
              {formatCurrency(wallet?.balance || 0)}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Gift className="w-5 h-5 text-orange-500" />
              <span className="font-medium">Tiền Tặng (Bonus)</span>
            </div>
            <div className="text-3xl font-bold text-foreground">
              {formatCurrency(wallet?.bonus_balance || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Lịch sử giao dịch
          </h2>
        </div>

        <div className="divide-y divide-border/50">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Chưa có giao dịch nào.</div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'deposit' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                    {tx.type === 'deposit' ? <ArrowDownRight className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm sm:text-base">
                      {tx.note || (tx.type === 'deposit' ? 'Nạp tiền' : 'Trừ tiền')}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      {new Date(tx.created_at).toLocaleString('vi-VN')} • Nguồn: {tx.source === 'bonus_balance' ? 'Tiền Tặng' : 'Tiền Nạp'}
                    </p>
                  </div>
                </div>
                <div className={`font-bold text-sm sm:text-lg ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Nạp tiền */}
      {showDepositModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDepositModal(false);
          }}
          className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          style={{ margin: 0, padding: '1rem' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl relative"
          >
            <button
              onClick={() => setShowDepositModal(false)}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-muted rounded-full"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-[#ae2070]/10 flex items-center justify-center">
                <span className="text-[#ae2070] font-black text-lg">M</span>
              </div>
              <h3 className="text-2xl font-bold">Nạp tiền</h3>
            </div>
            <p className="text-muted-foreground text-sm mb-6">Nạp tiền vào Ví Nông Xu qua MoMo. Tối thiểu 10,000đ.</p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Số tiền (VNĐ)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => { setDepositAmount(e.target.value); setDepositError(""); }}
                  placeholder="Ví dụ: 100000"
                  min="10000"
                  className="w-full bg-background border border-input rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 transition-all text-lg"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[50000, 100000, 200000, 500000].map(val => (
                  <button
                    key={val}
                    onClick={() => { setDepositAmount(val); setDepositError(""); }}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-colors border ${
                      Number(depositAmount) === val
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-muted text-muted-foreground border-transparent hover:bg-primary/5 hover:text-primary"
                    }`}
                  >
                    {(val / 1000)}k
                  </button>
                ))}
              </div>

              {depositError && (
                <p className="text-sm text-red-500 font-medium">{depositError}</p>
              )}

              <button
                onClick={handleDeposit}
                disabled={depositing || !depositAmount || Number(depositAmount) < 10000}
                className="w-full bg-[#ae2070] text-white py-3.5 rounded-xl font-bold shadow-md hover:shadow-lg hover:bg-[#9a1c63] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
              >
                {depositing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <span className="text-lg font-black">M</span>
                    Nạp qua MoMo — {Number(depositAmount || 0).toLocaleString("vi-VN")}đ
                  </>
                )}
              </button>

              <p className="text-xs text-center text-muted-foreground">
                Bạn sẽ được chuyển đến trang thanh toán MoMo để hoàn tất giao dịch.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
