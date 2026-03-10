import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './UI';

describe('Legacy UI Button', () => {
  it('keeps button text in normal layout flow', () => {
    render(<Button size="lg">REGISTRARME</Button>);

    const button = screen.getByRole('button', { name: 'REGISTRARME' });
    const contentWrapper = button.firstElementChild as HTMLElement | null;

    expect(button).toBeInTheDocument();
    expect(contentWrapper).not.toBeNull();
    expect(contentWrapper?.className).not.toContain('absolute');
    expect(contentWrapper?.className).not.toContain('inset-0');
  });
});
