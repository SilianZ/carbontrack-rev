import Silian_React from 'react';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { Shield as Silian_Shield, Award as Silian_Award, Users as Silian_Users } from 'lucide-react';

export default function TrustSection(){
  const { t: Silian_t } = Silian_useTranslation(['home']);
  return (
    <section className="bg-card/65 py-16 px-4 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <div className="flex flex-col items-center">
            <Silian_Shield className="h-12 w-12 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{Silian_t('home.trust.secure')}</h3>
            <p className="text-muted-foreground">{Silian_t('home.trust.secureDescription')}</p>
          </div>
          <div className="flex flex-col items-center">
            <Silian_Award className="h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{Silian_t('home.trust.verified')}</h3>
            <p className="text-muted-foreground">{Silian_t('home.trust.verifiedDescription')}</p>
          </div>
          <div className="flex flex-col items-center">
            <Silian_Users className="h-12 w-12 text-purple-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{Silian_t('home.trust.community')}</h3>
            <p className="text-muted-foreground">{Silian_t('home.trust.communityDescription')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
