# AntennePatch — Soutenance (2 minutes)

> Plateforme de supervision d'antennes IoT en temps réel
> **https://antenne-patch-iot.netlify.app**

---

## 1. Fiche d'identité (à retenir)

| | |
|---|---|
| **Nom** | AntennePatch — Supervision IoT |
| **Problème** | Des antennes déployées sur le terrain sont muettes : on ignore si elles fonctionnent, où elles sont, et ce qu'elles captent |
| **Solution** | Une plateforme web reliée au matériel Arduino/ESP32, qui supervise, localise et mesure en temps réel |
| **Technologies** | Next.js 15 · React 19 · TypeScript · Leaflet/OpenStreetMap · Netlify (serverless) · ESP32/Arduino |
| **Livrables** | Application web responsive + firmware Arduino + API REST documentée |

---

## 2. Script minuté (~250 mots)

### ▸ Introduction — 20 secondes

> « AntennePatch est une plateforme de supervision d'antennes IoT.
>
> Le problème est simple : quand on déploie des antennes sur le terrain, on ne sait
> ni si elles fonctionnent, ni exactement où elles sont, ni ce qu'elles captent
> autour d'elles.
>
> Ma solution relie le matériel Arduino au web, en temps réel. »

### ▸ Démonstration — 40 secondes

> « Voici le tableau de bord : les antennes, leur signal, température, batterie —
> actualisés en continu, avec des alertes automatiques.
>
> Sur la carte : ma position GPS suivie en temps réel, mes antennes, et **en violet
> les antennes réelles des opérateurs** autour de moi, issues d'OpenStreetMap.
>
> Ici, le **calcul de liaison** : je choisis un émetteur et un récepteur,
> l'application calcule la distance géodésique, l'azimut de pointage et le bilan de
> liaison radio. »

### ▸ Technique — 40 secondes

> « Côté matériel, un ESP32 équipé d'un module GPS envoie sa télémétrie en HTTPS,
> authentifiée par une clé API.
>
> Il **balaye aussi les antennes WiFi environnantes** et remonte leur puissance
> réellement mesurée. On peut également le brancher en USB : le navigateur lit
> directement le port série grâce à l'API Web Serial.
>
> Les calculs reposent sur des formules établies : **Haversine** pour la distance
> géodésique, **Friis** pour l'affaiblissement en espace libre. »

### ▸ Résultats — 15 secondes

> « L'application est en ligne, déployée automatiquement à chaque modification.
> **69 tests unitaires** valident les parties critiques : décodage GPS, agrégation
> de l'historique et balayage radio. »

### ▸ Conclusion — 5 secondes

> « AntennePatch transforme des antennes muettes en un réseau supervisé, mesurable
> et exportable. »

---

## 3. Parcours de démonstration (si on vous demande de montrer)

**Ordre conseillé — 3 écrans maximum, ne vous dispersez pas :**

1. **Tableau de bord** → « supervision temps réel, alertes automatiques »
2. **Carte** → activez le bouton violet → « antennes réelles des opérateurs »
3. **Liaison / Distance** → choisissez deux antennes → « distance, azimut, bilan radio »

*Bonus si le temps le permet :* onglet **Équipement USB** avec la carte branchée.

> ⚠️ Préparez l'onglet **avant** de parler : ouvrez la page, autorisez la
> géolocalisation, laissez la carte charger. Ne le faites pas devant le jury.

---

## 4. Points forts à mettre en avant

| Argument | Pourquoi ça compte |
|---|---|
| **Données réelles, pas simulées** | Les antennes affichées viennent d'OpenStreetMap ; le balayage WiFi mesure de vrais signaux |
| **Chaîne complète** | Du capteur physique jusqu'à l'interface web — pas seulement une maquette |
| **Deux voies de connexion** | WiFi/HTTPS à distance, ou USB en local via Web Serial |
| **Sécurité** | Endpoint protégé par clé API, comparaison à temps constant (anti-attaque temporelle) |
| **Industrialisation** | Déploiement continu automatique, persistance, export CSV pour rapports |

---

## 5. Chiffres clés

- **11 routes API REST** (télémétrie, balayage, historique, export, configuration…)
- **69 tests unitaires** — 22 décodage GPS/NMEA · 24 agrégation historique · 23 balayage radio
- **30 jours** d'historique conservés, agrégés par heure (720 points/antenne)
- **54 antennes réelles** détectées dans un rayon de 10 km lors des essais
- **~90 secondes** entre une modification et sa mise en ligne

---

## 6. Questions probables du jury — et vos réponses

**« Les antennes affichées sont-elles réelles ? »**
> Oui. Les antennes violettes proviennent d'OpenStreetMap, la base cartographique
> collaborative — ce sont des pylônes et tours réellement recensés. Et le module
> ESP32 détecte en plus les émetteurs WiFi qu'il capte physiquement, avec leur
> puissance mesurée en dBm.

**« Comment calculez-vous la distance ? »**
> Par la formule de Haversine, qui donne la distance géodésique sur la sphère
> terrestre — plus juste qu'une distance plane, indispensable dès quelques
> kilomètres.

**« Et le bilan de liaison ? »**
> J'applique la formule de Friis : l'affaiblissement en espace libre vaut
> 20·log(distance) + 20·log(fréquence) + 32,44. Je compare la puissance reçue à la
> sensibilité du récepteur pour obtenir la marge de liaison en décibels.

**« La distance estimée par le WiFi est-elle fiable ? »**
> C'est un ordre de grandeur, pas une mesure. J'utilise le modèle log-distance,
> mais les murs et obstacles la faussent nettement. La donnée fiable, c'est le RSSI
> lui-même. *(Assumer cette limite est un point fort devant un jury.)*

**« Comment sécurisez-vous l'accès des modules ? »**
> Chaque module présente une clé API dans un en-tête HTTP. Le serveur la compare en
> temps constant pour éviter les attaques temporelles. Sans clé valide, l'API
> répond 401.

**« Que se passe-t-il si le GPS ne répond pas ? »**
> L'application bascule sur une estimation par adresse IP, moins précise, et le
> signale clairement à l'utilisateur. Dès qu'un vrai point GPS arrive, il reprend
> la main automatiquement.

**« Quelles limites reconnaissez-vous ? »**
> Trois, assumées : OpenStreetMap n'est pas exhaustif ; la connexion USB exige
> Chrome ou Edge sur ordinateur ; et l'application n'a pas encore
> d'authentification utilisateur — c'est la prochaine étape.

---

## 7. Perspectives (si on vous demande « et après ? »)

1. **Authentification** des utilisateurs et gestion des rôles
2. **Base de données** dédiée pour un historique au-delà de 30 jours
3. **Notifications** par e-mail ou SMS sur alerte critique
4. **Triangulation** : plusieurs modules captant la même antenne permettraient de
   la localiser précisément, au lieu d'estimer une distance

---

## 8. Aide-mémoire — les 3 phrases à ne pas rater

1. *« Le problème : des antennes déployées sur le terrain sont muettes. »*
2. *« Ma solution relie le matériel Arduino au web, en temps réel. »*
3. *« AntennePatch transforme des antennes muettes en un réseau supervisé,
   mesurable et exportable. »*

**Conseils de présentation :** parlez lentement, 2 minutes c'est court mais
suffisant ; ne lisez pas vos écrans, regardez le jury ; assumez les limites, cela
inspire davantage confiance qu'une promesse excessive.
