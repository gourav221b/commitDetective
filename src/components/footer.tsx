export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="py-4 px-4 sm:px-6 lg:px-8 border-t bg-card">
      <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
        <p> {year} CommitDetective.</p>
      </div>
    </footer>
  );
}
