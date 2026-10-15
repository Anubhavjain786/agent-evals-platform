import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import StatusBadge from './StatusBadge.vue';
import VerdictBadge from './VerdictBadge.vue';

describe('badges never rely on colour alone', () => {
  it('labels every verdict in words', () => {
    expect(mount(VerdictBadge, { props: { verdict: 'better' } }).text()).toBe('Better');
    expect(mount(VerdictBadge, { props: { verdict: 'no_detectable_difference' } }).text()).toBe(
      'No detectable difference',
    );
  });

  it('shows the outcome of completed runs and the status otherwise', () => {
    expect(mount(StatusBadge, { props: { status: 'completed', outcome: 'fail' } }).text()).toBe(
      'Fail',
    );
    expect(mount(StatusBadge, { props: { status: 'error' } }).text()).toBe('Provider/setup error');
    expect(
      mount(StatusBadge, { props: { status: 'running' } })
        .find('svg')
        .exists(),
    ).toBe(true);
  });
});
