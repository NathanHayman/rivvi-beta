export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-grid-small-[#fff]/[0.20] min-h-svh w-full overflow-hidden bg-[#3A379F]/[0.975] lg:min-h-svh">
      {children}
    </div>
  );
}
