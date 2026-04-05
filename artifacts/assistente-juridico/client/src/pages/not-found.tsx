import { useEffect } from "react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/");
  }, [setLocation]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Redirecionando...</p>
    </div>
  );
}
