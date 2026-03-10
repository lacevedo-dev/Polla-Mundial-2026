import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeaguesOverview } from '../LeaguesOverview';
import { DashboardLeague } from '../../../stores/dashboard.store';

describe('LeaguesOverview Component', () => {
  const mockLeagues: DashboardLeague[] = [
    {
      id: '1',
      nombre: 'Liga Test 1',
      posicion: 1,
      tusPuntos: 100,
      maxPuntos: 100,
      participantes: 5,
    },
    {
      id: '2',
      nombre: 'Liga Test 2',
      posicion: 2,
      tusPuntos: 80,
      maxPuntos: 100,
      participantes: 10,
    },
    {
      id: '3',
      nombre: 'Liga Test 3',
      posicion: 5,
      tusPuntos: 50,
      maxPuntos: 100,
      participantes: 20,
    },
  ];

  it('renders empty state when ligas array is empty', () => {
    render(<LeaguesOverview ligas={[]} loading={false} />);

    expect(screen.getByText('No participas en ligas')).toBeInTheDocument();
  });

  it('renders league cards with correct data', () => {
    render(<LeaguesOverview ligas={mockLeagues} loading={false} />);

    expect(screen.getByText('Liga Test 1')).toBeInTheDocument();
    expect(screen.getByText('Liga Test 2')).toBeInTheDocument();
    expect(screen.getByText('Liga Test 3')).toBeInTheDocument();
  });

  it('displays positions with correct medals', () => {
    render(<LeaguesOverview ligas={mockLeagues} loading={false} />);

    // Check for medal emojis in aria-labels or text
    const medals = ['🥇', '🥈', '📍'];
    medals.forEach((medal) => {
      expect(document.body.textContent).toContain(medal);
    });
  });

  it('displays progress bar with correct percentages', () => {
    render(<LeaguesOverview ligas={mockLeagues} loading={false} />);

    const region = screen.getByRole('region', { name: /Ligas del usuario/i });
    expect(region).toBeInTheDocument();

    // Check for progress values
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars).toHaveLength(3);

    // First league: 100%
    expect(progressBars[0]).toHaveAttribute('aria-valuenow', '100');
    // Second league: 80%
    expect(progressBars[1]).toHaveAttribute('aria-valuenow', '80');
    // Third league: 50%
    expect(progressBars[2]).toHaveAttribute('aria-valuenow', '50');
  });

  it('shows loading state with skeleton cards', () => {
    const { container } = render(
      <LeaguesOverview ligas={[]} loading={true} />
    );

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders correct participant count', () => {
    render(<LeaguesOverview ligas={mockLeagues} loading={false} />);

    expect(screen.getByText(/5 participante/)).toBeInTheDocument();
    expect(screen.getByText(/10 participantes/)).toBeInTheDocument();
    expect(screen.getByText(/20 participantes/)).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<LeaguesOverview ligas={mockLeagues} loading={false} />);

    const region = screen.getByRole('region', { name: /Ligas del usuario/i });
    expect(region).toBeInTheDocument();

    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(3);
  });
});
