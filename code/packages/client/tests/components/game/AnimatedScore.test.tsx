// Verifies: REQ-NF-U02 — Score tally animation
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimatedScore } from '@/components/game/AnimatedScore';

describe('AnimatedScore (REQ-NF-U02)', () => {
  it('renders the initial value immediately', () => {
    render(<AnimatedScore value={150} />);
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('renders zero', () => {
    render(<AnimatedScore value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders negative values', () => {
    render(<AnimatedScore value={-100} />);
    expect(screen.getByText('-100')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<AnimatedScore value={42} className="test-class" />);
    expect(container.querySelector('.test-class')).not.toBeNull();
  });

});
