import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBanner } from '../ErrorBanner';

describe('ErrorBanner Component', () => {
  it('renders error message correctly', () => {
    render(
      <ErrorBanner message="Ocurrió un error al cargar los datos" />
    );

    expect(screen.getByText('Ocurrió un error al cargar los datos')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(
      <ErrorBanner
        message="Error de conexión"
        onRetry={onRetry}
      />
    );

    const retryButton = screen.getByRole('button', { name: /Reintentar/i });
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('removes banner when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <ErrorBanner
        message="Error"
        dismissable={true}
        onDismiss={onDismiss}
      />
    );

    const dismissButton = screen.getByRole('button', { name: /Cerrar/i });
    fireEvent.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledOnce();
    // The banner should be hidden
    expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
  });

  it('does not show dismiss button when dismissable is false', () => {
    render(
      <ErrorBanner
        message="Error"
        dismissable={false}
      />
    );

    expect(screen.queryByRole('button', { name: /Cerrar/i })).not.toBeInTheDocument();
  });

  it('does not show retry button when onRetry is not provided', () => {
    render(
      <ErrorBanner message="Error" />
    );

    expect(screen.queryByRole('button', { name: /Reintentar/i })).not.toBeInTheDocument();
  });

  it('has alert role and aria-live attribute', () => {
    render(
      <ErrorBanner message="Critical error" />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveAttribute('aria-atomic', 'true');
  });
});
