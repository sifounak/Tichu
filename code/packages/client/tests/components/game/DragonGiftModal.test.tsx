// Verifies: REQ-F-DR01
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DragonGiftModal } from '../../../src/components/game/DragonGiftModal';

describe('DragonGiftModal', () => {
  const options = ['east', 'west'] as const;
  const onGift = vi.fn();

  it('renders dialog with correct title', () => {
    render(<DragonGiftModal options={[...options]} onGift={onGift} />);
    expect(screen.getByRole('dialog', { name: /gift dragon trick/i })).toBeInTheDocument();
    expect(screen.getByText('Dragon Trick')).toBeInTheDocument();
  });

  it('renders a button for each opponent', () => {
    render(<DragonGiftModal options={[...options]} onGift={onGift} />);
    expect(screen.getByRole('button', { name: /give trick to east/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /give trick to west/i })).toBeInTheDocument();
  });

  it('calls onGift with the chosen seat', async () => {
    const mockGift = vi.fn();
    const user = userEvent.setup();
    render(<DragonGiftModal options={[...options]} onGift={mockGift} />);
    await user.click(screen.getByRole('button', { name: /give trick to west/i }));
    expect(mockGift).toHaveBeenCalledWith('west');
  });

  it('renders only active opponents', () => {
    render(<DragonGiftModal options={['east']} onGift={onGift} />);
    expect(screen.getByRole('button', { name: /give trick to east/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /give trick to west/i })).not.toBeInTheDocument();
  });

  it('shows subtitle text', () => {
    render(<DragonGiftModal options={[...options]} onGift={onGift} />);
    expect(screen.getByText(/choose which opponent/i)).toBeInTheDocument();
  });
});
