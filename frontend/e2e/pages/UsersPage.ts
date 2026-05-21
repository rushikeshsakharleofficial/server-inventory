import { type Page, type Locator } from '@playwright/test'

export class UsersPage {
  readonly addButton: Locator
  readonly rows: Locator
  readonly usernameInput: Locator
  readonly passwordInput: Locator
  readonly roleSelect: Locator
  readonly saveButton: Locator

  constructor(private readonly page: Page) {
    this.addButton = page.getByRole('button', { name: /add user/i })
    this.rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') })
    this.usernameInput = page.getByLabel(/username/i)
    this.passwordInput = page.getByLabel(/password/i)
    this.roleSelect = page.getByLabel(/role/i)
    this.saveButton = page.getByRole('button', { name: /save|create/i })
  }

  async goto(): Promise<void> { await this.page.goto('/users') }
}
