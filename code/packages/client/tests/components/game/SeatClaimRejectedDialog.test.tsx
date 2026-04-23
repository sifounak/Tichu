// Verifies: REQ-F-SJ07
import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  SeatClaimRejectedDialog,
  type SeatClaimRejection,
} from '@/components/game/SeatClaimRejectedDialog';

const baseRejection: SeatClaimRejection = {
  reason:
    'You cannot claim the East seat because you already saw the North seat'
    + ' cards during this game.',
  originalSeat: 'north',
  requestedSeat: 'east',
  currentOccupant: null,
  offerClaimOriginal: true,
};

describe('SeatClaimRejectedDialog (REQ-F-SJ07)', () => {
  it('renders nothing when rejection is null', () => {
    const { container } = render(
      <SeatClaimRejectedDialog
        rejection={null}
        onClose={() => {}}
        onClaimOriginal={() => {}}
      />,
    );
    // The portal target (document.body) should have no dialog content
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    // And nothing is rendered in the component's own container either
    expect(container).toBeEmptyDOMElement();
  });

  it('displays the server-provided reason text', () => {
    render(
      <SeatClaimRejectedDialog
        rejection={baseRejection}
        onClose={() => {}}
        onClaimOriginal={() => {}}
      />,
    );
    expect(screen.getByText(baseRejection.reason)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Seat claim rejected');
  });

  it('shows the "Claim {originalSeat} instead" button when offerClaimOriginal is true', () => {
    render(
      <SeatClaimRejectedDialog
        rejection={baseRejection}
        onClose={() => {}}
        onClaimOriginal={() => {}}
      />,
    );
    // Uses a prefix-match to avoid coupling to exact label casing
    expect(screen.getByRole('button', { name: /claim north instead/i })).toBeInTheDocument();
  });

  it('hides the "Claim {originalSeat} instead" button when offerClaimOriginal is false', () => {
    render(
      <SeatClaimRejectedDialog
        rejection={{ ...baseRejection, offerClaimOriginal: false }}
        onClose={() => {}}
        onClaimOriginal={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /claim .* instead/i })).toBeNull();
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('clicking "Claim {originalSeat} instead" invokes onClaimOriginal with originalSeat + closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onClaimOriginal = vi.fn();
    render(
      <SeatClaimRejectedDialog
        rejection={baseRejection}
        onClose={onClose}
        onClaimOriginal={onClaimOriginal}
      />,
    );

    await user.click(screen.getByRole('button', { name: /claim north instead/i }));
    expect(onClaimOriginal).toHaveBeenCalledWith('north');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking Close invokes onClose without onClaimOriginal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onClaimOriginal = vi.fn();
    render(
      <SeatClaimRejectedDialog
        rejection={baseRejection}
        onClose={onClose}
        onClaimOriginal={onClaimOriginal}
      />,
    );

    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClaimOriginal).not.toHaveBeenCalled();
  });

  it('clicking the backdrop dismisses via onClose (bubble from overlay, not inner panel)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <SeatClaimRejectedDialog
        rejection={baseRejection}
        onClose={onClose}
        onClaimOriginal={() => {}}
      />,
    );

    // The role="dialog" element has the backdrop click handler (the outer overlay).
    const backdrop = screen.getByRole('dialog');
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking inside the inner panel does NOT dismiss (stopPropagation)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <SeatClaimRejectedDialog
        rejection={baseRejection}
        onClose={onClose}
        onClaimOriginal={() => {}}
      />,
    );

    // Clicking the reason paragraph is a click inside the panel — should not dismiss
    await user.click(screen.getByText(baseRejection.reason));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('updates content when the rejection prop changes between renders', () => {
    const { rerender } = render(
      <SeatClaimRejectedDialog
        rejection={baseRejection}
        onClose={() => {}}
        onClaimOriginal={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /claim north instead/i })).toBeInTheDocument();

    rerender(
      <SeatClaimRejectedDialog
        rejection={{
          ...baseRejection,
          originalSeat: 'west',
          reason: 'different reason',
        }}
        onClose={() => {}}
        onClaimOriginal={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /claim west instead/i })).toBeInTheDocument();
    expect(screen.getByText('different reason')).toBeInTheDocument();

    cleanup();
  });
});
