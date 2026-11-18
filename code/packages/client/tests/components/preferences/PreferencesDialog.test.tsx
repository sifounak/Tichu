// Verifies: REQ-F-UP02–UP06, REQ-NF-UP01
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_USER_PREFERENCES } from '@tichu/shared';
import { PreferencesDialog } from '@/components/preferences/PreferencesDialog';
import { usePreferencesStore } from '@/stores/preferencesStore';

const store = () => usePreferencesStore.getState();
const ids = (label: string) => Array.from(screen.getByRole('img', { name: label }).querySelectorAll('[data-card-id]')).map((el) => el.getAttribute('data-card-id'));

describe('Preferences dialog', () => {
  beforeEach(() => {
    store().setAccount(null, null);
    usePreferencesStore.setState({ userId: 'alice', token: 'token', preferences: { ...DEFAULT_USER_PREFERENCES },
      open: true, draft: { ...DEFAULT_USER_PREFERENCES }, loading: false, saving: false, error: null });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url, init) => ({ ok: true,
      json: async () => ({ preferences: init?.body ? JSON.parse(init.body) : DEFAULT_USER_PREFERENCES }) })));
  });

  it('updates one non-interactive example hand without affecting saved preferences', async () => {
    const user = userEvent.setup();
    render(<PreferencesDialog />);
    const descending = ids('Example hand');
    expect(descending[0]).toBe('108');
    await user.click(screen.getByRole('radio', { name: 'Low to high' }));
    expect(ids('Example hand')).toEqual([...descending].reverse());
    await user.click(screen.getByRole('radio', { name: 'Left cards on top' }));
    const cards = screen.getByRole('img', { name: 'Example hand' }).querySelectorAll('[data-card-id]');
    expect(cards[0]).toHaveAttribute('data-identifier-side', 'right');
    expect(Number((cards[0].parentElement as HTMLElement).style.zIndex)).toBeGreaterThan(Number((cards[1].parentElement as HTMLElement).style.zIndex));
    expect(screen.getAllByRole('img', { name: 'Example hand' })).toHaveLength(1);
    expect(screen.queryByRole('img', { name: /Full house/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Full house')).not.toBeInTheDocument();
    expect(within(screen.getByRole('img', { name: 'Example hand' })).queryAllByRole('button')).toHaveLength(0);
    expect(store().preferences).toEqual(DEFAULT_USER_PREFERENCES);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('saves only when changed and applies returned values', async () => {
    const user = userEvent.setup();
    render(<PreferencesDialog />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.click(screen.getByRole('switch', { name: 'Chat' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(store().preferences.chatSound).toBe(false);
  });

  it('retains category choices when master sound is turned off and back on', async () => {
    const user = userEvent.setup();
    render(<PreferencesDialog />);
    await user.click(screen.getByRole('switch', { name: 'Chat' }));
    await user.click(screen.getByRole('switch', { name: 'Sound enabled' }));
    for (const name of ['Cards and wagers', 'Your turn', 'Timer warning', 'Chat']) expect(screen.getByRole('switch', { name })).toBeDisabled();
    await user.click(screen.getByRole('switch', { name: 'Sound enabled' }));
    expect(screen.getByRole('switch', { name: 'Chat' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Timer warning' })).toBeChecked();
  });

  it.each(['Cancel', 'Close preferences', 'Escape', 'backdrop'])('discards drafts via %s', async (method) => {
    const user = userEvent.setup();
    render(<PreferencesDialog />);
    await user.click(screen.getByRole('radio', { name: 'Low to high' }));
    if (method === 'Escape') await user.keyboard('{Escape}');
    else if (method === 'backdrop') fireEvent.click(screen.getByTestId('preferences-backdrop'));
    else await user.click(screen.getByRole('button', { name: method }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store().draft).toBeNull();
    expect(store().preferences).toEqual(DEFAULT_USER_PREFERENCES);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('traps focus and restores the opener after cancellation', async () => {
    const opener = document.createElement('button');
    document.body.append(opener); opener.focus();
    const user = userEvent.setup();
    render(<PreferencesDialog />);
    expect(screen.getByRole('dialog')).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close preferences' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it('shows loading/error, disables editing, and retries loading', async () => {
    usePreferencesStore.setState({ draft: null, loading: true });
    render(<PreferencesDialog />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    act(() => usePreferencesStore.setState({ loading: false, error: 'Could not load preferences' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('radio', { name: 'Low to high' })).toBeInTheDocument();
  });

  it('keeps a failed save open with the draft available for retry', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    render(<PreferencesDialog />);
    await userEvent.click(screen.getByRole('radio', { name: 'Low to high' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('retry Save');
    expect(screen.getByRole('radio', { name: 'Low to high' })).toBeChecked();
    expect(store().preferences.cardOrder).toBe('descending');
  });
});
