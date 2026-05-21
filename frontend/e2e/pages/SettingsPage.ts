import { type Page, type Locator } from '@playwright/test'

export class SettingsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> { await this.page.goto('/settings') }

  inputFor(key: string): Locator {
    return this.page.getByLabel(new RegExp(key, 'i'))
  }

  saveButtonFor(key: string): Locator {
    return this.page.getByRole('row', { name: new RegExp(key, 'i') })
      .getByRole('button', { name: /save/i })
  }
}
