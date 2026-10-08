import { test, expect } from './fixtures';

// test/component/galleryMount.spec.ts

test('cold gallery mounts a real component', async ({ mount }) => {
    const root = await mount('lxSources');
    await expect(root.getByRole('button', { name: 'LX custom sources', exact: true })).toBeVisible();
});

test('each navigation waits for delayed gallery registration, preserving update and unmount', async ({ page, mount }) => {
    // Hold the real gallery registration until the mount consumer actually checks readiness.
    // This event gate makes the old immediate check fail without sleeps or retries.
    let checked!: () => void;
    await page.exposeBinding('galleryRegistrationChecked', () => checked());
    await page.addInitScript(() => {
        let registered: typeof window.mount | undefined;
        let released = false;
        Object.defineProperty(window, 'mount', {
            configurable: true,
            set(value: typeof window.mount) { registered = value; },
            get() {
                if (!released) {
                    void (window as any).galleryRegistrationChecked();
                    return undefined;
                }
                return registered;
            },
        });
        (window as any).releaseGalleryRegistration = () => { released = true; };
        sessionStorage.setItem('galleryNavigations', String(Number(sessionStorage.getItem('galleryNavigations')) + 1));
    });

    for (let navigation = 1; navigation <= 2; navigation++) {
        const readinessChecked = new Promise<void>(resolve => { checked = resolve; });
        // Handle rejection immediately so RED reports the mount error, not an unhandled promise.
        const mounting = mount('lxSources').then(root => ({ root }), error => ({ error }));
        await readinessChecked;
        await page.evaluate(() => (window as any).releaseGalleryRegistration());
        const result = await mounting;
        if ('error' in result) throw result.error;
        await expect(result.root.getByRole('button', { name: 'LX custom sources', exact: true })).toBeVisible();
        expect(await page.evaluate(() => localStorage.getItem('galleryDirty'))).toBeNull();
        await page.evaluate(() => localStorage.setItem('galleryDirty', 'true'));
        await result.root.update();
        expect(await page.evaluate(() => localStorage.getItem('galleryDirty'))).toBe('true');
        expect(await page.evaluate(() => sessionStorage.getItem('galleryNavigations'))).toBe(String(navigation));
        await result.root.unmount();
        await expect(result.root).toBeEmpty();
    }
});
