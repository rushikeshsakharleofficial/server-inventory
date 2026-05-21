import { type Page, type Locator } from '@playwright/test'

export class LoginPage {
  readonly usernameInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator

  constructor(private readonly page: Page) {
    this.usernameInput = page.getByLabel('Username')
    this.passwordInput = page.getByLabel('Password')
    this.submitButton = page.getByRole('button', { name: 'Sign In' })
    this.errorMessage = page.getByRole('alert')
  }

  async goto(): Promise<void> { await this.page.goto('/') }

  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}
