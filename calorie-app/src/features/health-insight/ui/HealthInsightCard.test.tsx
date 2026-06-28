// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HealthInsightCard } from './HealthInsightCard';
import { analyticsApi } from '../../../entities/nutrition/api/analyticsApi';

vi.mock('../../../entities/nutrition/api/analyticsApi', () => ({
  analyticsApi: { getInsight: vi.fn() },
}));

const getInsight = vi.mocked(analyticsApi.getInsight);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('HealthInsightCard', () => {
  it('renders the insight and reveals the facts behind the toggle', async () => {
    getInsight.mockResolvedValue({
      insight: 'Solid protein this week, but fiber looks low — add legumes or whole grains.',
      factsUsed: [
        { id: 'fiber-legumes-001', text: 'Legumes are high in soluble fiber.' },
      ],
      generatedBy: 'logos:gpt-oss-120b',
      result: 'success',
    });

    render(<HealthInsightCard />);

    // The model-generated text appears once the fetch resolves.
    expect(await screen.findByText(/add legumes or whole grains/i)).toBeTruthy();
    expect(getInsight).toHaveBeenCalledWith('week');

    // Facts are collapsed behind an accessible toggle by default.
    const toggle = screen.getByRole('button', { name: /based on/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/high in soluble fiber/i)).toBeNull();

    // Expanding the toggle reveals the supporting facts.
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/high in soluble fiber/i)).toBeTruthy();
  });

  it('renders nothing when the insight is unavailable', async () => {
    getInsight.mockResolvedValue({
      insight: null,
      result: 'unavailable',
      factsUsed: [],
      generatedBy: '',
    });

    const { container } = render(<HealthInsightCard />);

    // Starts as a loading skeleton, then collapses to nothing.
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });
});
