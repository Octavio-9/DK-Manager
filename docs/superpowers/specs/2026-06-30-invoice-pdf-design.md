# Reçu de paiement PDF — Design

## Contexte

Dans la page Factures, ajouter la génération d'un PDF "Reçu de paiement" téléchargeable directement, reprenant exactement la mise en page du modèle fourni (en-tête DK Production, tableau DESCRIPTION/PRIX/PAYER/RESTE, bandeau TOTAL noir, pied de page). Nécessite d'ajouter le suivi du montant payé par ligne de facture.

## Changement de schéma

**`InvoiceItem`** — ajout d'une colonne :

| Colonne | Type | Notes |
|---|---|---|
| `paid` | numeric not null default 0 | Montant payé pour cette ligne |

`Reste` = `price * quantity - paid` (calculé côté front, pas stocké).

Le TOTAL du bas du PDF = somme des `paid` de toutes les lignes (montant total encaissé), fidèle au modèle fourni.

Aucune autre modification de schéma.

## Génération PDF

Bibliothèque : **`@react-pdf/renderer`** (nouvelle dépendance npm).

- Rendu vectoriel natif (texte net, pas une image rasterisée).
- Composants React déclaratifs mappant directement la mise en page du modèle.
- Produit un Blob `.pdf` déclenché par un bouton "Télécharger PDF" → `URL.createObjectURL()` + `<a download>`.

## Structure du PDF (fidèle au modèle)

```
┌─────────────────────────────────────────────────────┐
│  [logo texte "DK"]  REÇU DE PAIEMENT    [logo txt]  │
├──────────────────┬──────────────────────────────────┤
│  Facture n°XXXX  │  10/02/2026                      │
├──────────────────┴──────────────────────────────────┤
│  DK PRODUCTION          À L'ATTENTION DE            │
│  611-14-43-34           Nom Client                  │
│  contact@dkprod...      Téléphone client            │
│  Fossidet rond-point    Email client                │
├─────────────────────────────────────────────────────┤
│  DESCRIPTION    PRIX    PAYER    RESTE               │  ← en-tête noir
│  Inscription    50 000  50 000   0                   │
│  Formation      1 000 000  500 000  500 000          │
├─────────────────────────────────────────────────────┤
│                         TOTAL : 550 000 GNF  ← noir │
├─────────────────────────────────────────────────────┤
│  Paiement effectué par [Nom client]                  │
│  Conditions de paiement / Paiement sous 15 jours    │
│               ___________________________           │
│               Le Directeur Général                  │
├─────────────────────────────────────────────────────┤
│             MERCI DE VOTRE CONFIANCE                 │
└─────────────────────────────────────────────────────┘
```

**Coordonnées DK Production** (constantes hardcodées) :
- Téléphone : `611-14-43-34`
- Email : `contact@dkproduction.space`
- Adresse : `Fossidet rond-point`

**Données client** : `client.name`, `client.phone`, `client.email` depuis la relation `clientRel` déjà chargée dans `fetchInvoices()`.

**Logo** : pas de fichier image disponible dans le projet — rendu textuel stylisé "DK" en blanc sur fond violet `#9d3bf1` (cohérent avec l'identité visuelle de l'app). Pas de tampon/signature manuscrite (aucun asset disponible) — remplacé par une ligne de signature texte "Le Directeur Général".

**Devise** : GNF (Franc guinéen), format `new Intl.NumberFormat('fr-FR')` sans décimales + ` GNF`.

## Intégration UI

- Bouton icône **"Télécharger PDF"** (`Download` de lucide-react) ajouté sur chaque ligne de la liste des factures, à côté de "Modifier".
- Même bouton dans le footer de la modale d'édition.
- Un composant `InvoicePDF` (fichier dédié `src/components/InvoicePDF.jsx`) reçoit l'objet facture complet et exporte le `<Document>` react-pdf.
- Un helper `downloadInvoicePDF(invoice)` dans `src/lib/invoicePdf.js` encapsule la logique `pdf().toBlob()` + déclenchement du téléchargement.

## Modification du formulaire

Colonne "Payé (GNF)" ajoutée dans la table des lignes de facture dans la modale d'édition, après "P.U." :

`Description | Qté | P.U. | Payé | Total`

Affiche le RESTE calculé live en bas : `Total facturé - Total payé = Reste`.

## Hors scope

- Pas de settings page pour les coordonnées société (hardcodées).
- Pas de tampon/signature graphique.
- Pas de multi-devise (GNF uniquement sur le PDF).
- Pas de prévisualisation PDF intégrée (juste téléchargement direct).
