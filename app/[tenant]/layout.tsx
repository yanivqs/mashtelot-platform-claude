export default function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { tenant: string };
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white p-4 text-center font-bold text-xl shadow">
        אתר משתלה - {params.tenant}
      </header>
      <main>{children}</main>
    </div>
  );
}