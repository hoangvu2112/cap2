import { Receipt, CheckCircle, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import api from "@/lib/api";

export default function InvoicePopup({ 
  isOpen, 
  onClose, 
  requestId, 
  invoiceData, 
  onSuccess 
}) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !invoiceData) return null;

  const handlePay = async () => {
    setPaying(true);
    setError(null);
    try {
      const res = await api.post("/wallet/pay-commission", { request_id: requestId });
      if (res.data.success) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || "C├│ lß╗ùi xß║úy ra khi thanh to├ín.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="relative bg-card w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
            <Receipt className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold">Ho├í ─É╞ín Chß╗æt ─É╞ín</h2>
          <p className="text-primary-foreground/80 text-sm mt-1">
            Vui l├▓ng thanh to├ín hoa hß╗ông ─æß╗â ho├án tß║Ñt
          </p>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center pb-3 border-b border-border/50">
              <span className="text-muted-foreground">Sß║ún phß║⌐m</span>
              <span className="font-semibold text-foreground text-right">{invoiceData.product_name}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-border/50">
              <span className="text-muted-foreground">Gi├í chß╗æt</span>
              <span className="font-semibold text-foreground text-right">{formatCurrency(invoiceData.proposed_price)}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-border/50">
              <span className="text-muted-foreground">Sß╗æ l╞░ß╗úng</span>
              <span className="font-semibold text-foreground text-right">{invoiceData.quantity}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-border/50">
              <span className="text-muted-foreground">Tß╗òng gi├í trß╗ï ─æ╞ín</span>
              <span className="font-bold text-foreground text-right text-base">{formatCurrency(invoiceData.total_value)}</span>
            </div>
          </div>

          <div className="bg-muted/50 rounded-2xl p-4 flex justify-between items-center border border-border/50">
            <div>
              <span className="block text-sm font-medium text-muted-foreground mb-1">Ph├¡ hoa hß╗ông</span>
              <span className="text-xs text-muted-foreground">* ├üp dß╗Ñng theo thang ph├¡ hß╗ç thß╗æng</span>
            </div>
            <span className="text-2xl font-bold text-red-600">
              {formatCurrency(invoiceData.fee_amount)}
            </span>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-500/10 p-3 rounded-xl text-sm font-medium">
              <XCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button 
              onClick={onClose}
              disabled={paying}
              className="py-3 rounded-xl font-medium text-muted-foreground bg-muted hover:bg-muted/80 transition-colors"
            >
              Hß╗ºy bß╗Å
            </button>
            <button 
              onClick={handlePay}
              disabled={paying}
              className="py-3 rounded-xl font-bold text-white bg-primary hover:bg-primary/90 transition-all shadow-md hover:shadow-lg disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {paying ? (
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  X├íc nhß║¡n trß║ú
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
