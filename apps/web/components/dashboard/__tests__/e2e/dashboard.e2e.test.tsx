/**
 * Dashboard E2E / Component Integration Tests
 *
 * These tests simulate full user flows using Vitest + Testing Library in a jsdom environment.
 * Playwright is not installed in this project; these tests cover the same scenarios
 * using component-level rendering with mocked stores.
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import { StatCard } from '../../StatCard';
import { PerformanceChart } from '../../PerformanceChart';
import { LeaguesOverview } from '../../LeaguesOverview';
import { ErrorBanner } from '../../ErrorBanner';
import { PersonalStats } from '../../PersonalStats';

// ─── Shared test data ────────────────────────────────────────────────────────

const mockStats = {
  aciertos: 45,
  errores: 10,
  racha: 3,
  tasa: 81.82,
};

const mockLeagues = [
  {
    id: '1',
    nombre: 'Liga Premium',
    posicion: 1,
    tusPuntos: 450,
    maxPuntos: 500,
    participantes: 25,
  },
  {
    id: '2',
    nombre: 'Liga Amateur',
    posicion: 3,
    tusPuntos: 200,
    maxPuntos: 400,
    participantes: 10,
  },
];

const mockPerformance = [
  { week: '2026-W01', points: 60 },
  { week: '2026-W02', points: 75 },
  { week: '2026-W03', points: 50 },
  { week: '2026-W04', points: 90 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const renderWithRouter = (ui: React.ReactElement) =>
  render(<BrowserRouter>{ui}</BrowserRouter>);

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Dashboard E2E / Full Component Scenarios', () => {
  describe('Scenario 1: Full dashboard renders all sections', () => {
    it('renders Stats row, Performance chart, and Leagues overview together', () => {
      const { container } = render(
        <div>
          {/* Stats row — 4 StatCards */}
          <section aria-label="stats-row">
            <StatCard label="Aciertos" value={mockStats.aciertos} color="lime" loading={false} />
            <StatCard label="Errores" value={mockStats.errores} color="rose" loading={false} />
            <StatCard label="Racha" value={mockStats.racha} color="amber" loading={false} />
            <StatCard label="Tasa %" value={mockStats.tasa.toFixed(1)} color="blue" loading={false} />
          </section>

          {/* Performance chart */}
          <PerformanceChart data={mockPerformance} loading={false} />

          {/* Leagues overview */}
          <LeaguesOverview ligas={mockLeagues} loading={false} />
        </div>,
      );

      // Stats cards
      expect(screen.getByText('Aciertos')).toBeInTheDocument();
      expect(screen.getByText('Errores')).toBeInTheDocument();
      expect(screen.getByText('Racha')).toBeInTheDocument();
      expect(screen.getByText('Tasa %')).toBeInTheDocument();

      // Performance chart heading
      expect(screen.getByText('Desempeño por Semana')).toBeInTheDocument();

      // Leagues
      expect(screen.getByText('Liga Premium')).toBeInTheDocument();
      expect(screen.getByText('Liga Amateur')).toBeInTheDocument();

      expect(container).toBeTruthy();
    });
  });

  describe('Scenario 2: Stats row shows exactly 4 cards', () => {
    it('renders 4 distinct StatCard regions', () => {
      render(
        <div>
          <StatCard label="Aciertos" value={45} color="lime" loading={false} />
          <StatCard label="Errores" value={10} color="rose" loading={false} />
          <StatCard label="Racha" value={3} color="amber" loading={false} />
          <StatCard label="Tasa %" value="81.8" color="blue" loading={false} />
        </div>,
      );

      const regions = screen.getAllByRole('region');
      expect(regions).toHaveLength(4);

      expect(screen.getByRole('region', { name: /Aciertos: 45/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /Errores: 10/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /Racha: 3/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /Tasa %: 81.8/i })).toBeInTheDocument();
    });

    it('renders 4 skeleton cards in loading state', () => {
      const { container } = render(
        <div>
          <StatCard label="Aciertos" value={0} color="lime" loading={true} />
          <StatCard label="Errores" value={0} color="rose" loading={true} />
          <StatCard label="Racha" value={0} color="amber" loading={true} />
          <StatCard label="Tasa %" value={0} color="blue" loading={true} />
        </div>,
      );

      const skeletons = container.querySelectorAll('[role="status"]');
      expect(skeletons).toHaveLength(4);
    });
  });

  describe('Scenario 3: Performance chart renders', () => {
    it('renders chart with weekly data points', () => {
      render(<PerformanceChart data={mockPerformance} loading={false} />);

      expect(screen.getByRole('region', { name: /Gráfico de desempeño semanal/i })).toBeInTheDocument();
      expect(screen.getByText('Desempeño por Semana')).toBeInTheDocument();
      expect(screen.getByText(/Últimas 4 semanas/i)).toBeInTheDocument();
    });

    it('renders skeleton when loading', () => {
      const { container } = render(
        <PerformanceChart data={[]} loading={true} />,
      );

      const pulseEls = container.querySelectorAll('.animate-pulse');
      expect(pulseEls.length).toBeGreaterThan(0);
    });

    it('renders empty state when no data', () => {
      render(<PerformanceChart data={[]} loading={false} />);

      expect(
        screen.getByText('No hay datos de desempeño disponibles'),
      ).toBeInTheDocument();
    });

    it('renders SVG polyline for data points', () => {
      const { container } = render(
        <PerformanceChart data={mockPerformance} loading={false} />,
      );

      const polyline = container.querySelector('polyline');
      expect(polyline).not.toBeNull();
      expect(polyline?.getAttribute('stroke')).toBe('#65a30d');
    });
  });

  describe('Scenario 4: Leagues overview renders', () => {
    it('renders all league cards', () => {
      render(<LeaguesOverview ligas={mockLeagues} loading={false} />);

      const articles = screen.getAllByRole('article');
      expect(articles).toHaveLength(2);

      expect(screen.getByText('Liga Premium')).toBeInTheDocument();
      expect(screen.getByText('Liga Amateur')).toBeInTheDocument();
    });

    it('renders correct participant counts', () => {
      render(<LeaguesOverview ligas={mockLeagues} loading={false} />);

      expect(screen.getByText(/25 participantes/i)).toBeInTheDocument();
      expect(screen.getByText(/10 participantes/i)).toBeInTheDocument();
    });

    it('renders progress bars for each league', () => {
      render(<LeaguesOverview ligas={mockLeagues} loading={false} />);

      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars).toHaveLength(2);

      // Liga Premium: 450/500 = 90%
      expect(progressBars[0]).toHaveAttribute('aria-valuenow', '90');
      // Liga Amateur: 200/400 = 50%
      expect(progressBars[1]).toHaveAttribute('aria-valuenow', '50');
    });

    it('renders empty state with no leagues', () => {
      render(<LeaguesOverview ligas={[]} loading={false} />);

      expect(screen.getByText('No participas en ligas')).toBeInTheDocument();
    });
  });

  describe('Scenario 5: Retry button works on error', () => {
    it('calls onRetry handler when Reintentar is clicked', () => {
      const onRetry = vi.fn();

      render(
        <ErrorBanner
          message="Error al cargar los datos del dashboard"
          onRetry={onRetry}
          dismissable={false}
        />,
      );

      const retryButton = screen.getByRole('button', { name: /Reintentar/i });
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('shows error message in alert role', () => {
      render(
        <ErrorBanner
          message="Error fetching dashboard data"
          onRetry={vi.fn()}
        />,
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText('Error fetching dashboard data')).toBeInTheDocument();
    });

    it('dismisses banner when close button is clicked', () => {
      render(
        <ErrorBanner
          message="Some error"
          dismissable={true}
        />,
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();

      const closeButton = screen.getByRole('button', { name: /Cerrar/i });
      fireEvent.click(closeButton);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Scenario 6: Mobile layout (simulated small viewport)', () => {
    let originalInnerWidth: number;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalInnerWidth,
      });
    });

    it('StatCard renders on mobile viewport without errors', () => {
      render(
        <StatCard label="Aciertos" value={45} color="lime" loading={false} />,
      );

      expect(screen.getByRole('region')).toBeInTheDocument();
      expect(window.innerWidth).toBe(375);
    });

    it('LeaguesOverview renders on mobile viewport', () => {
      render(<LeaguesOverview ligas={mockLeagues} loading={false} />);

      const region = screen.getByRole('region', { name: /Ligas del usuario/i });
      expect(region).toBeInTheDocument();
    });

    it('PerformanceChart renders correctly on mobile viewport', () => {
      render(<PerformanceChart data={mockPerformance} loading={false} />);

      expect(
        screen.getByRole('region', { name: /Gráfico de desempeño semanal/i }),
      ).toBeInTheDocument();
    });

    it('PersonalStats renders on mobile viewport', () => {
      render(
        <PersonalStats
          aciertos={45}
          errores={10}
          racha={3}
          promedioPorcentaje={81.82}
          loading={false}
        />,
      );

      expect(
        screen.getByRole('region', { name: /Estadísticas personales/i }),
      ).toBeInTheDocument();
    });

    it('full dashboard section renders without JS errors on mobile', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <div>
          <StatCard label="Aciertos" value={45} color="lime" loading={false} />
          <StatCard label="Errores" value={10} color="rose" loading={false} />
          <StatCard label="Racha" value={3} color="amber" loading={false} />
          <StatCard label="Tasa %" value="81.8" color="blue" loading={false} />
          <PerformanceChart data={mockPerformance} loading={false} />
          <LeaguesOverview ligas={mockLeagues} loading={false} />
        </div>,
      );

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
