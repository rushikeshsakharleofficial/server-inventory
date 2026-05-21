import { authedTest, expect } from './fixtures/auth'

const VIEWS = [
  { nav: 'Dashboard',      heading: 'Dashboard'        },
  { nav: 'Servers',        heading: 'Server Inventory'  },
  { nav: 'Databases',      heading: 'Databases'         },
  { nav: 'Kubernetes',     heading: 'Kubernetes'        },
  { nav: 'Block Storage', heading: 'Block Storage'     },
  { nav: 'Cloud Providers',heading: 'Cloud Providers'   },
  { nav: 'Sync Logs',      heading: 'Sync Logs'         },
  { nav: 'Cron Jobs',      heading: 'Cron Jobs'         },
  { nav: 'SSH',            heading: 'SSH Credentials'   },
  { nav: 'Settings',       heading: 'Settings'          },
]

// Scope clicks to the sidebar nav to avoid matching header action buttons
const navBtn = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('navigation').getByRole('button', { name, exact: true })

authedTest.describe('Navigation', () => {
  for (const { nav, heading } of VIEWS) {
    authedTest(`navigates to ${heading}`, async ({ page }) => {
      // Inventory sub-items live inside a collapsible group — open it first if needed
      if (['Servers', 'Databases', 'Kubernetes'].includes(nav)) {
        const subBtn = navBtn(page, nav)
        const isOpen = await subBtn.isVisible().catch(() => false)
        if (!isOpen) await navBtn(page, 'Inventory').click()
        await subBtn.waitFor({ state: 'visible', timeout: 3000 })
      }
      await navBtn(page, nav).click()
      // Use header h1 directly — it's the authoritative page title and avoids
      // ambiguity with page-level headings in content areas
      await expect(page.locator('header h1')).toHaveText(heading, { timeout: 5000 })
    })
  }
})
