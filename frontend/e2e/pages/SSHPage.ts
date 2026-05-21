import { type Page, type Locator } from '@playwright/test'

export class SSHPage {
  readonly addButton: Locator
  readonly rows: Locator
  readonly nameInput: Locator
  readonly usernameInput: Locator
  readonly passwordInput: Locator
  readonly saveButton: Locator

  constructor(private readonly page: Page) {
    this.addButton = page.getByRole('button', { name: /add|new ssh/i })
    this.rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') })
    this.nameInput = page.getByLabel(/name/i)
    this.usernameInput = page.getByLabel(/username/i)
    this.passwordInput = page.getByLabel(/password/i)
    this.saveButton = page.getByRole('button', { name: /save|create/i })
  }

  async goto(): Promise<void> { await this.page.goto('/ssh') }

  setDefaultButton(rowIndex: number): Locator {
    return this.rows.nth(rowIndex).getByRole('button', { name: /set default/i })
  }
}
