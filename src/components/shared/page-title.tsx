export function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-xl font-bold text-white">
      <span className="w-1 h-6 bg-yellow-500 rounded-sm" />
      {children}
    </h2>
  )
}
