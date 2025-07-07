export function Footer() {
    const [year, setYear] = React.useState(new Date().getFullYear());
  
    return (
      <footer className="py-4 px-4 sm:px-6 lg:px-8 border-t bg-card">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          <p>Built by Firebase Studio. © {year} CommitDetective.</p>
        </div>
      </footer>
    );
  }
  
  import * as React from 'react';
  