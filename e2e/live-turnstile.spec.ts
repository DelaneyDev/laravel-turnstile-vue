import { expect, test } from '@playwright/test';
import type { ConsoleMessage } from '@playwright/test';

function isKnownCloudflareConsoleNoise(message: ConsoleMessage): boolean {
    return (
        message.type() === 'warning' &&
        message.location().url.startsWith('https://challenges.cloudflare.com/') &&
        message.text().includes('Feature Policy: Skipping unsupported feature name')
    );
}

test('loads one shared script and completes visible and invisible test widgets', async ({
    page,
}) => {
    const pageErrors: Error[] = [];
    const consoleFailures: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    page.on('console', (message) => {
        if (
            (message.type() === 'error' || message.type() === 'warning') &&
            !isKnownCloudflareConsoleNoise(message)
        ) {
            consoleFailures.push(message.text());
        }
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Turnstile harness' })).toBeVisible();
    await expect(
        page.locator('script[src*="challenges.cloudflare.com/turnstile"]'),
    ).toHaveCount(1);

    const visibleWidget = page.getByTestId('visible-widget');
    await expect(visibleWidget).toHaveAttribute('data-turnstile-state', 'success');
    await expect(page.getByTestId('visible-token')).not.toHaveText('Waiting');
    await expect(page.getByTestId('events')).toContainText('visible:success');

    await page.getByRole('button', { name: 'Challenge' }).click();
    const invisibleWidget = page.getByTestId('invisible-widget');
    await expect(invisibleWidget).toHaveAttribute('data-turnstile-state', 'success');
    await expect(page.getByTestId('invisible-token')).not.toHaveText('Waiting');
    await expect(page.getByTestId('events')).toContainText('invisible:success');

    expect(pageErrors).toEqual([]);
    expect(consoleFailures).toEqual([]);
});

test('keeps controls and widget containers usable on a narrow viewport', async ({
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Challenge' })).toBeInViewport();
    await expect(page.getByTestId('visible-widget')).toBeInViewport();
    expect(
        await page.evaluate(
            () =>
                document.documentElement.scrollWidth <=
                document.documentElement.clientWidth,
        ),
    ).toBe(true);
});
