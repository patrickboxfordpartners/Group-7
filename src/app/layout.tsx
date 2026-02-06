import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Credibility Intelligence Agent',
  description: 'Autonomous credibility monitoring and response system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const intercomAppId = process.env.NEXT_PUBLIC_INTERCOM_APP_ID?.trim();
  const intercomEmail = (process.env.INTERCOM_TEST_USER_EMAIL || 'demo@boxfordpartners.com').trim();

  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {intercomAppId && (
          <Script id="intercom-widget" strategy="lazyOnload">
            {`
              window.intercomSettings = {
                api_base: "https://api-iam.intercom.io",
                app_id: "${intercomAppId}",
                email: "${intercomEmail}",
                name: "Demo Operator"
              };
              (function(){var w=window;var ic=w.Intercom;if(typeof ic==="function"){ic('reattach_activator');ic('update',w.intercomSettings);}else{var d=document;var i=function(){i.c(arguments);};i.q=[];i.c=function(args){i.q.push(args);};w.Intercom=i;var l=function(){var s=d.createElement('script');s.type='text/javascript';s.async=true;s.src='https://widget.intercom.io/widget/${intercomAppId}';var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x);};if(document.readyState==='complete'){l();}else if(w.attachEvent){w.attachEvent('onload',l);}else{w.addEventListener('load',l,false);}}})();
            `}
          </Script>
        )}
      </body>
    </html>
  );
}
