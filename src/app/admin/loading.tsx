export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6 md:p-12">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium animate-pulse">Carregando painel...</p>
      </div>
    </main>
  );
}
