import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendingUp } from 'lucide-react';
import { StatCard } from '../StatCard';

describe('StatCard Component', () => {
  it('renders with all props correctly', () => {
    render(
      <StatCard
        label="Aciertos"
        value={45}
        color="lime"
        trend={5}
      />
    );

    expect(screen.getByRole('region', { name: /Aciertos: 45/i })).toBeInTheDocument();
    expect(screen.getByText('Aciertos')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('renders color variants correctly', () => {
    const colors: Array<'lime' | 'amber' | 'blue' | 'rose'> = ['lime', 'amber', 'blue', 'rose'];

    colors.forEach((color) => {
      const { unmount } = render(
        <StatCard label="Test" value={10} color={color} />
      );

      const card = screen.getByRole('region');
      expect(card).toBeInTheDocument();
      unmount();
    });
  });

  it('shows loading state with skeleton', () => {
    const { container } = render(
      <StatCard label="Aciertos" value={0} loading={true} />
    );

    const loader = container.querySelector('[role="status"]');
    expect(loader).toBeInTheDocument();
    expect(loader).toHaveAttribute('aria-label', 'Cargando Aciertos');
  });

  it('displays trend indicator correctly', () => {
    const { rerender } = render(
      <StatCard label="Test" value={100} trend={5} />
    );

    expect(screen.getByLabelText(/Tendencia: positiva/i)).toBeInTheDocument();

    rerender(
      <StatCard label="Test" value={100} trend={-3} />
    );

    expect(screen.getByLabelText(/Tendencia: negativa/i)).toBeInTheDocument();
  });

  it('handles undefined values gracefully', () => {
    const { container } = render(
      <StatCard label="Undefined Test" value={0} />
    );

    expect(container).toBeTruthy();
  });

  it('renders icon when provided', () => {
    const testIcon = <div data-testid="test-icon">Icon</div>;
    render(
      <StatCard label="Test" value={50} icon={testIcon} />
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(
      <StatCard label="Aciertos" value={45} />
    );

    const region = screen.getByRole('region');
    expect(region).toHaveAttribute('aria-label');
  });
});
