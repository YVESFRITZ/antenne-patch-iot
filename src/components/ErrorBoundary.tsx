"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-screen items-center justify-center bg-surface p-6 text-center">
            <div>
              <p className="text-lg font-semibold text-ink">Erreur d&apos;affichage</p>
              <p className="mt-2 text-sm text-ink-muted">
                Rechargez la page. Si le problème persiste, redémarrez le serveur.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm text-white"
              >
                Recharger
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
