export async function chooseTheme(page, name) {
 const label=name[0].toUpperCase()+name.slice(1);
 const button=page.getByRole('button',{name:'Theme '+label,exact:true});
 if(!await button.isVisible())await page.getByLabel('Appearance',{exact:true}).click();
 await button.click();
 const menu=page.locator('.crm-appearance-menu');
 if(await menu.count())await menu.evaluate(el=>{el.open=false;});
}
