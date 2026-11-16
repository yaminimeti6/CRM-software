'use client';
import type {ReactNode} from 'react';
import {useCrmTheme} from './use-crm-theme';
import {CrmIcon,CrmThemeSwitch} from './app/crm-shell';
export function AuthFrame({children}:{children:ReactNode}){
 const [theme,chooseTheme]=useCrmTheme();
 return <div className="crm-shell crm-reference crm-auth-frame" data-workspace-design="reference" data-crm-theme={theme}><header className="crm-auth-topbar"><a className="crm-auth-brand" href="/login"><span className="crm-brand-mark"><CrmIcon name="leads"/></span><strong>Staff CRM</strong></a><CrmThemeSwitch theme={theme} onChange={chooseTheme}/></header><div className="crm-auth-content">{children}</div></div>;
}
