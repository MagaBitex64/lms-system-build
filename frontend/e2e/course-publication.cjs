// Run only against the disposable publication stack (3102/8102).
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const credentials=JSON.parse(fs.readFileSync(process.env.E2E_CREDENTIALS_FILE,'utf8'))
;(async()=>{
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 await page.goto('http://localhost:3102/login')
 await page.getByRole('textbox',{name:'Электрондық пошта',exact:true}).fill(credentials.email)
 await page.getByRole('textbox',{name:'Құпиясөз',exact:true}).fill(credentials.password)
 await page.getByRole('button',{name:'Жүйеге кіру',exact:true}).click()
 await page.waitForURL('**/dashboard')
 const token=await page.evaluate(()=>sessionStorage.getItem('lms_token')||localStorage.getItem('lms_token'))
 const headers={Authorization:'Bearer '+token}
 const response=await page.request.post('http://localhost:8102/courses',{headers,data:{title:'Publication browser fixture',description:'Disposable UI test',is_published:false}})
 assert(response.ok());const course=await response.json()
 await page.goto('http://localhost:3102/courses/'+course.id)
 for(const [width,height] of [[1440,900],[390,844]]){
 await page.setViewportSize({width,height})
 await page.getByRole('button',{name:'Параметрлер',exact:true}).click()
 await page.getByRole('menuitem',{name:'Жариялау',exact:true}).click()
 const dialog=page.getByRole('dialog')
 await dialog.getByRole('button',{name:'Жариялау',exact:true}).click()
 await page.getByRole('status').filter({hasText:'Курс жарияланды.'}).waitFor()
 await page.reload()
 await page.getByText('Жарияланған',{exact:true}).waitFor()
 const catalog=await page.request.get('http://localhost:8102/courses',{headers})
 assert((await catalog.json()).items.some(c=>c.id===course.id))
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 await page.getByRole('button',{name:'Параметрлер',exact:true}).click()
 await page.getByRole('menuitem',{name:'Жариялаудан алып тастау',exact:true}).click()
 fs.mkdirSync('/tmp/fenomen-publication-proof',{recursive:true})
 await page.getByRole('dialog').evaluate(el => Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished)));
 await page.screenshot({animations:'disabled',path:`/tmp/fenomen-publication-proof/confirmation-${width}.png`})
 await page.getByRole('dialog').getByRole('button',{name:'Жариялаудан алып тастау',exact:true}).click()
 await page.getByRole('status').filter({hasText:'Курс жариялаудан алынды.'}).waitFor()
 await page.reload();await page.getByText('Жоба',{exact:true}).waitFor()
 console.log(`PASS: publish/unpublish, persistence, catalog, confirmation and overflow ${width}x${height}`)
 }
} finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
