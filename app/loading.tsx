export default function Loading() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
    </div>
  )
}
