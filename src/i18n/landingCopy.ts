import type { Locale } from './types';

export interface LandingFeatureCopy {
  title: string;
  description: string;
}

export interface LandingCopy {
  heading: string;
  subtitle: string;
  features: {
    doaList: LandingFeatureCopy;
    scipPortal: LandingFeatureCopy;
    npf: LandingFeatureCopy;
  };
  footer: {
    about: string;
    contact: string;
    privacy: string;
    copyright: string;
    lastUpdated: string;
    contactSubject: string;
  };
  theme: {
    switchToDark: string;
    switchToLight: string;
  };
  about: {
    title: string;
    description: string;
    hubTitle: string;
    introduction: string;
    keyFeaturesTitle: string;
    keyFeatures: LandingFeatureCopy[];
    disclaimerTitle: string;
    disclaimer: string;
    maintainedBy: string;
    close: string;
  };
  privacy: {
    title: string;
    description: string;
    generalNoticeTitle: string;
    generalNotice: string;
    informationTitle: string;
    information: string;
    informationBullets: string[];
    externalLinksTitle: string;
    externalLinks: string;
    close: string;
  };
  scipConfirmation: {
    title: string;
    introduction: string;
    externalServiceNote: string;
    copyPrompt: string;
    cancel: string;
  };
  copyLinkStatus: {
    copy: string;
    copied: string;
    failed: string;
  };
  navigationStatus: {
    continue: string;
    opening: string;
  };
}

export const landingCopy: Record<Locale, LandingCopy> = {
  en: {
    heading: '32 CBG G8 Administration Hub',
    subtitle: 'Comprehensive Gateway to Financial Resources',
    features: {
      doaList: {
        title: '32 CBG DOA List',
        description: 'Access the current 32 CBG Delegation of Authority list in SharePoint.',
      },
      scipPortal: {
        title: 'SCIP Portal',
        description:
          'Streamlined Claims Interface Platform for efficient digital submission and processing of administrative claims.',
      },
      npf: {
        title: 'NPF',
        description:
          'Read the public NPP / NPF Guide for plain-language spending, grants, vendors, and reimbursement guidance.',
      },
    },
    footer: {
      about: 'About',
      contact: 'Contact',
      privacy: 'Privacy',
      copyright:
        '© {year} G8 Administration Hub. All rights reserved. Not affiliated with DND or CAF.',
      lastUpdated: 'Last updated: {date}',
      contactSubject: 'Contacting from G8 homepage',
    },
    theme: {
      switchToDark: 'Switch to dark mode',
      switchToLight: 'Switch to light mode',
    },
    about: {
      title: 'About This Page',
      description: 'What the 32 CBG G8 Administration Hub links to and what it does not provide.',
      hubTitle: '32 CBG G8 Admin Hub',
      introduction:
        'A navigation hub for 32 CBG G8 administrative resources, including delegation of authority references, SCIP access, contact and resource links, and supporting administrative material.',
      keyFeaturesTitle: 'Key Features',
      keyFeatures: [
        {
          title: '32 CBG DOA List',
          description: 'Current delegation of authority reference in SharePoint',
        },
        {
          title: 'SCIP Portal',
          description: 'Direct access to the claims submission platform',
        },
        {
          title: 'NPF',
          description: 'Public guide to NPP and NPF administration',
        },
      ],
      disclaimerTitle: 'Disclaimer',
      disclaimer:
        'This page is an unofficial resource hub. It does not provide AI-generated advice and is not affiliated with DND, CAF, or any government department. Always verify critical information through official channels.',
      maintainedBy: 'Maintained by the 32 CBG G8 Team',
      close: 'Close',
    },
    privacy: {
      title: 'Privacy Policy',
      description: 'How this landing page handles visit analytics and external links.',
      generalNoticeTitle: 'General Privacy Notice',
      generalNotice:
        'This landing page is a navigation hub for administrative links and resources. The landing page does not ask you to sign in, does not accept free-text submissions, and does not provide AI-generated responses.',
      informationTitle: 'Information Processed by This Page',
      information:
        'When you visit the site, the browser may send basic visit analytics used to understand page traffic and troubleshoot availability.',
      informationBullets: [
        'Those analytics can include the page path, referrer, page title, browser language, viewport size, a locally generated session ID, and browser user-agent.',
        'The landing page does not collect names, service numbers, claim details, financial information, or message content.',
        'The landing page does not send your activity to any AI model.',
      ],
      externalLinksTitle: 'Links to External Services',
      externalLinks:
        'Some buttons open external resources such as SharePoint or SCIP. Those services are separate from this landing page and may have their own access controls, logs, and privacy practices.',
      close: 'Close',
    },
    scipConfirmation: {
      title: 'SCIP Portal',
      introduction:
        'You are about to navigate to the SCIP Portal, which is an external Microsoft PowerApps platform. Have your D365 login (@ecn.forces.gc.ca) ready.',
      externalServiceNote: 'This will open in a new tab. Do you want to continue?',
      copyPrompt:
        'If the portal does not open, please copy the URL below and paste it directly into your browser:',
      cancel: 'Cancel',
    },
    copyLinkStatus: {
      copy: 'Copy Link',
      copied: 'Link Copied',
      failed: 'Failed to copy to clipboard.',
    },
    navigationStatus: {
      continue: 'Continue',
      opening: 'Opening…',
    },
  },
  fr: {
    heading: 'Portail administratif G8 du 32 GBC',
    subtitle: 'Portail central des ressources financières',
    features: {
      doaList: {
        title: 'Liste des pouvoirs délégués du 32 GBC',
        description: 'Consultez dans SharePoint la liste actuelle des pouvoirs délégués du 32 GBC.',
      },
      scipPortal: {
        title: 'Portail SCIP',
        description:
          'Plateforme simplifiée d’interface des réclamations pour présenter et traiter efficacement les réclamations administratives en ligne.',
      },
      npf: {
        title: 'NPF',
        description:
          'Consultez le Guide des BNP / FNP pour obtenir des conseils clairs sur les dépenses, les subventions, les fournisseurs et les remboursements.',
      },
    },
    footer: {
      about: 'À propos',
      contact: 'Contact',
      privacy: 'Confidentialité',
      copyright:
        '© {year} Portail administratif G8. Tous droits réservés. Non affilié au MDN ni aux FAC.',
      lastUpdated: 'Dernière mise à jour : {date}',
      contactSubject: 'Contact depuis la page d’accueil du G8',
    },
    theme: {
      switchToDark: 'Passer au mode sombre',
      switchToLight: 'Passer au mode clair',
    },
    about: {
      title: 'À propos de cette page',
      description: 'Ce que le portail administratif G8 du 32 GBC relie et ce qu’il ne fournit pas.',
      hubTitle: 'Portail administratif G8 du 32 GBC',
      introduction:
        'Un portail vers les ressources administratives du G8 du 32 GBC, notamment les références sur les pouvoirs délégués, l’accès à SCIP, les liens de contact et de ressources ainsi que du matériel administratif connexe.',
      keyFeaturesTitle: 'Fonctions principales',
      keyFeatures: [
        {
          title: 'Liste des pouvoirs délégués du 32 GBC',
          description: 'Référence actuelle aux pouvoirs délégués dans SharePoint',
        },
        {
          title: 'Portail SCIP',
          description: 'Accès direct à la plateforme de présentation des réclamations',
        },
        {
          title: 'NPF',
          description: 'Guide public sur l’administration des BNP et des FNP',
        },
      ],
      disclaimerTitle: 'Avis',
      disclaimer:
        'Cette page est un portail de ressources non officiel. Elle ne fournit pas de conseils générés par l’IA et n’est pas affiliée au MDN, aux FAC ni à un ministère. Vérifiez toujours les renseignements importants auprès des sources officielles.',
      maintainedBy: 'Géré par l’équipe G8 du 32 GBC',
      close: 'Fermer',
    },
    privacy: {
      title: 'Politique de confidentialité',
      description:
        'La façon dont cette page traite les statistiques de visite et les liens externes.',
      generalNoticeTitle: 'Avis général de confidentialité',
      generalNotice:
        'Cette page est un portail vers des liens et des ressources administratifs. Elle ne demande pas de connexion, n’accepte pas de texte libre et ne fournit pas de réponses générées par l’IA.',
      informationTitle: 'Renseignements traités par cette page',
      information:
        'Lorsque vous visitez le site, le navigateur peut transmettre des statistiques de visite de base pour comprendre l’achalandage et diagnostiquer les problèmes de disponibilité.',
      informationBullets: [
        'Ces statistiques peuvent comprendre le chemin de la page, le référent, le titre de la page, la langue du navigateur, les dimensions de la fenêtre, un identifiant de session généré localement et l’agent utilisateur du navigateur.',
        'La page ne recueille pas de noms, de numéros de service, de détails de réclamation, de renseignements financiers ni de contenu de messages.',
        'La page n’envoie pas votre activité à un modèle d’IA.',
      ],
      externalLinksTitle: 'Liens vers des services externes',
      externalLinks:
        'Certains boutons ouvrent des ressources externes comme SharePoint ou SCIP. Ces services sont distincts de cette page et peuvent avoir leurs propres contrôles d’accès, journaux et pratiques de confidentialité.',
      close: 'Fermer',
    },
    scipConfirmation: {
      title: 'Portail SCIP',
      introduction:
        'Vous êtes sur le point d’accéder au portail SCIP, une plateforme Microsoft PowerApps externe. Préparez votre identifiant D365 (@ecn.forces.gc.ca).',
      externalServiceNote: 'Cette page s’ouvrira dans un nouvel onglet. Voulez-vous continuer?',
      copyPrompt:
        'Si le portail ne s’ouvre pas, copiez l’URL ci-dessous et collez-la directement dans votre navigateur :',
      cancel: 'Annuler',
    },
    copyLinkStatus: {
      copy: 'Copier le lien',
      copied: 'Lien copié',
      failed: 'Échec de la copie du lien.',
    },
    navigationStatus: {
      continue: 'Continuer',
      opening: 'Ouverture…',
    },
  },
};
