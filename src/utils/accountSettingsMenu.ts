export type AccountMenuItem = {
  label: string;
  href: string;
  active?: boolean;
};

/** Shared Settings sidebar links for account area pages. */
export function getAccountSettingsMenu(activeHref?: string): AccountMenuItem[] {
  const items: AccountMenuItem[] = [
    { label: "Account Settings", href: "/account-settings" },
    { label: "Change Password", href: "/change-password" },
    { label: "Your Default Address", href: "/address-book" },
    { label: "Delete Account", href: "/delete-account" },
  ];
  return items.map((item) => ({
    ...item,
    active: activeHref ? item.href === activeHref : false,
  }));
}
