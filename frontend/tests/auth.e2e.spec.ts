import { test, expect } from '@playwright/test';
import { login } from './helpers/login';

test.describe('Auth - Login y Logout', () => {
  test('Muestra error con credenciales inválidas', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input#username', 'invalid@emerald.com');
    await page.fill('input#password', 'WrongPass123');
    const [response] = await Promise.all([
      page.waitForResponse((res) =>
        res.url().includes('/v1/auth/login')
      ),
      page.click('button[type="submit"]'),
    ]);

    expect(response.status()).toBeGreaterThanOrEqual(400);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Acceso al Núcleo' })).toBeVisible();
  });

  test('Permite login exitoso y redirige a /app', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/app/);
  });

  test('Permite logout y vuelve a /login', async ({ page }) => {
    await login(page);

    const logoutButton = page.getByRole('button', { name: 'Salir' });
    await logoutButton.click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Acceso al Núcleo' })).toBeVisible();
  });
});
