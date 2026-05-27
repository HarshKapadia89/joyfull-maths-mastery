const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("pk_test_")) return null;
  return (
    <div className="w-full border-b border-orange-300 bg-orange-100 px-4 py-2 text-center text-sm text-orange-800">
      All payments made in the preview are in test mode. Use card{" "}
      <code className="font-mono">4242 4242 4242 4242</code>, any future expiry, any CVC.
    </div>
  );
}
