# Kurulum rehberi (ücretsiz)

## 1. Uygulamayı yayınla (GitHub Pages)
Bu işlem için bilgisayar kullan.

1. github.com'da ücretsiz hesap aç ve giriş yap.
2. Sağ üstteki **+** düğmesine bas, **New repository** seç.
3. Ad olarak `uygulama` yaz, **Public** seçili kalsın, **Create repository** de.
4. Açılan sayfada **uploading an existing file** bağlantısına bas.
5. Zip'i çıkar. Klasörün **içindeki her şeyi** seçip sayfaya sürükle.
6. Yükleme bitince **Commit changes** de.
7. **Settings → Pages** bölümüne gir. Branch olarak **main**, klasör olarak **/(root)** seç, **Save** de.
8. Bir iki dakika sonra adresin şöyle olur: `https://KULLANICI-ADIN.github.io/uygulama/`

Bu aşamada uygulama 24 maddeyle çalışır. Yönetici girişi için 2. adımı yap.

## 2. Yönetici girişini aç (Firebase)
1. console.firebase.google.com adresine Google hesabınla gir, **Create a project** de. Google Analytics'i kapatabilirsin.
2. **Build → Firestore Database → Create database** de. Konum olarak Avrupa seç, **production mode** ile devam et.
3. **Build → Authentication → Get started** de, **Email/Password** yöntemini aç.
4. **Users → Add user** ile kendi e-posta ve şifreni ekle.
5. Eklenen satırdaki **User UID** değerini kopyala.
6. **Firestore → Rules** sekmesini aç. `firestore.rules.txt` içeriğini yapıştır, `BURAYA_UID` yerine kopyaladığın değeri yaz, **Publish** de.
7. Proje ayarlarında (dişli simgesi) **Your apps → Web (</>)** ile bir web uygulaması ekle. Çıkan `firebaseConfig` değerlerini kopyala.
8. GitHub'da `config.js` dosyasını aç, kalem simgesine bas, boş alanları doldur, **Commit changes** de.
9. Birkaç dakika sonra uygulamayı aç: ⋮ → **Yönetici girişi** → giriş yap → **24 maddeyi veritabanına yükle**.

## 3. Telefona yükle
- **Android:** Adresi Chrome'da aç, ⋮ → **Uygulamayı yükle** veya **Ana ekrana ekle**.
- **iPhone:** Adresi Safari'de aç, Paylaş → **Ana Ekrana Ekle**.

## Uygulamanın adını değiştirmek
- Uygulama içindeki ad: Yönetici panelinden değiştirilir.
- Ana ekranda görünen ad: `manifest.webmanifest` içindeki `name` ve `short_name` alanlarından, ayrıca `config.js` içindeki `name` alanından değiştirilir. Sonra uygulamayı silip yeniden yükle.

## Sorun çıkarsa
- **Kamera açılmıyor:** Adres `https://` ile başlamalı. Tarayıcı ayarlarından kamera izni ver.
- **"Yönetici yetkisi yok":** Kurallardaki UID, giriş yaptığın hesabın UID'iyle aynı olmalı.
- **Etiket okunmuyor:** İlk kullanımda internet gerekir. Etiketi düz tut, iyi ışıkta yakından çek.

## İnternetten madde ekleme (PubChem)
- Arama kutusuna listede olmayan bir ad veya CAS numarası yazınca uygulama PubChem'de arar ve bilgileri gösterir.
- Yönetici girişi yaptıysan sonucun üstünde **Listeye kaydet** düğmesi çıkar.
- Yönetici panelindeki **İnternetten toplu ekle** kutusuna her satıra bir madde yazıp tek seferde 50 madde ekleyebilirsin.
- Uygunluk seviyesi tehlike kodlarından tahmin edilir. Eklediğin maddeleri **Düzenle** ile kontrol et.
- En iyi sonuç CAS numarası veya İngilizce adla alınır. Türkçe adların yalnızca yaygın olanları tanınır.
