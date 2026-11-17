export default function PageTitle({ children, sub }) {
  return (
    <header className="mb-1 px-1">
      <h1 className="text-2xl font-extrabold tracking-tight text-cocoa">{children}</h1>
      {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
    </header>
  )
}
