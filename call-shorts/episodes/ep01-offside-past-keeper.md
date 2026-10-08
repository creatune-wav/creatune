# You Make the Call — Bölüm 1 (pilot)
**Konu:** Kaleciyi geçmiş bir hücumcu neden yine de ofsayt olabilir?
**Format:** 1080x1920, 30 fps, 30 sn · Remotion kompozisyonu `offside-past-keeper`
**Video:** `out/offside-past-keeper.mp4` (git'e eklenmez; `npx remotion render src/index.ts offside-past-keeper out/offside-past-keeper.mp4` ile yeniden üretilir)

---

## 1. Kural doğrulaması (IFAB Law 11)

**Kaynak:** IFAB, *Laws of the Game*, Law 11 – Offside → https://www.theifab.com/laws/latest/offside/

**Önemli not:** Bu oturumdan theifab.com'a doğrudan erişim engelliydi. Aşağıdaki ifadeleri IFAB sayfasının arama motorundaki alıntılarından ve aynı metni aktaran ikincil kaynaklardan doğruladım. Yayından önce bağlantıyı açıp metni bir kez kendin kontrol et.

Videoda kullanılan maddeler (İngilizce ifadeler IFAB metninden):

| # | Kural | Videoda nerede |
|---|---|---|
| 1 | Oyuncu, başının, gövdesinin veya ayaklarının herhangi bir kısmı **rakip yarı sahadaysa** (orta çizgi hariç) ve **rakip kale çizgisine hem toptan hem de sondan ikinci rakipten daha yakınsa** ofsayt pozisyonundadır. | 15–20. sn kontrol listesi |
| 2 | Kollar ve eller (kaleciler dahil) dikkate alınmaz. | Videoda yok (gerek yok) |
| 3 | **Sondan ikinci rakiple ya da son iki rakiple aynı hizada** olan oyuncu ofsayt pozisyonunda değildir. | Kural kartı: "LEVEL = ONSIDE" |
| 4 | Ofsayt pozisyonunda olmak tek başına ihlal değildir. | Kurgunun mantığı: önce pozisyon, sonra "plays the ball" |
| 5 | Pozisyon, **topu takım arkadaşı oynadığı/dokunduğu anda** değerlendirilir. İlk temas noktası esas alınır. | "Paused at the pass" donması |
| 6 | Bu anda ofsayt pozisyonundaki oyuncu, takım arkadaşının pasladığı topu **oynarsa** (interfering with play) cezalandırılır. | 19.8–21.2. sn |
| 7 | Ceza: **ihlalin olduğu yerden endirekt serbest vuruş**. | 22.2. sn |

**2026/27 sezonu:** Arama sonuçlarına göre (IFAB'ın 2026/27 değişiklik dokümanı ve FiveRef özeti) bu sezon Law 11'deki değişiklik yarı otomatik ofsayt teknolojisinin (SAOT) kullanımıyla ilgili. Ofsayt pozisyonunun tanımı değişmemiş görünüyor. Dokümanı doğrudan açamadım, bu yüzden bunu kesin bilgi olarak değil, arama sonucu olarak not ediyorum.

**Videonun söylemediği istisnalar (yorumlara hazırlık için):**
- Kale vuruşu, taç atışı ve köşe vuruşundan doğrudan gelen topta ofsayt ihlali yoktur.
- Rakibin topu **bilerek oynaması** (kasıtlı kurtarış hariç) ofsayt değerlendirmesini sıfırlar.
- Savunmanın kendi ceza sahasında kazandığı serbest vuruşun alan içinde nereden kullanılabileceği **Law 13**'ün konusudur. Bunu bu oturumda doğrulamadım. Bu yüzden videoda "IFK HERE" yerine "OFFENCE HERE" yazıyor.

## 2. Pozisyon tanımı (hipotetik, gerçek bir maç değil)

Koordinatlar metre cinsinden. Orijin rakip kale çizgisinin ortası, y değeri kale çizgisine olan uzaklık.

**Pas anında:**

| Oyuncu | Takım | Konum (x, y) | Not |
|---|---|---|---|
| **9** (alıcı) | Hücum (mavi) | (5, 9) | Rakip yarı sahada |
| **10** (pasör) | Hücum | (−9, 24) | Top ayağında, y ≈ 23 |
| 7, 11 | Hücum | (17, 21), (−20, 31) | Oyuna karışmıyorlar |
| **4** (çizgideki defans) | Savunma (turuncu) | (2, 0.8) | **Son rakip**, 9'dan kale çizgisine daha yakın tek rakip |
| **GK** | Savunma | (−1, 13.5) | **Sondan ikinci rakip**, kaleden çıkmış, 9'un 4.5 m gerisinde |
| 5, 3, 6, 2 | Savunma | y = 20–32 | Hepsi 9'un gerisinde |

**Kontrol:**
- 9 rakip yarı sahada ✓
- Toptan daha ileride (9 < 23) ✓
- Sondan ikinci rakipten daha ileride (9 < 13.5) ✓ ve **aynı hizada değil**
- Sonuç: **ofsayt pozisyonu.**

Ardından 9, açık oyunda 10'un pasını oynuyor. Arada rakibin topu bilerek oynaması yok. Sonuç: **ofsayt ihlali → gol geçersiz, savunmaya endirekt serbest vuruş.**

**Varsayımlar** (videoda olgu gibi sunulmuyor, sahne "Illustration" olarak etiketli):
- Pas bir takım arkadaşından, açık oyunda geliyor. Duran top yok.
- Pas ile topu oynama arasında rakibin topa bilerek dokunması yok.
- Kalecinin neden kaleden çıktığı anlatılmıyor, çünkü kural açısından fark etmiyor.

## 3. Seslendirme metni (İngilizce, yaklaşık 70 kelime)

```
[0.0]  He's beaten the keeper. Only one defender on the line.
[5.4]  Goal or no goal? Your call.
[8.6]  Freeze the pass.
[9.5]  The keeper isn't special. Law 11 counts opponents.
[11.8] Last: the defender on the line. Second-last: the keeper.
[15.2] He's nearer the goal line than the ball and the second-last opponent. Offside position.
[19.8] And he plays the ball. No goal. Indirect free kick to the defence.
[24.0] Beat the keeper? Not enough. You need two opponents level with you, or nearer the goal line.
[28.7] Did you get it right?
```

**Ton:** Sakin, net, hafif oyunbaz bir hakem ya da analist sesi. ElevenLabs'te erkek veya kadın İngilizce bir anlatıcı sesi seç. Hız yaklaşık 160 kelime/dk olmalı.

## 4. Saniye saniye sahne planı

| Zaman | Ekran | Hareket (neyi açıklıyor) | Ses |
|---|---|---|---|
| **0.0–1.6** | Üst bant: "YOU MAKE THE CALL" + **"GOAL OR NO GOAL?"**. Saha pas anındaki pozisyonda. | Kalecinin etrafında beyaz halka: 9'un kaleciyi geçtiğini gösterir. | VO: "He's beaten the keeper." |
| **1.6–3.6** | Aynı kare | Halka çizgideki 4 numaraya geçer: "geriye bir defans kaldı" vurgusu. | VO: "Only one defender on the line." |
| **3.6–4.4** | Pas | Top 10'dan 9'a gider, arkasında iz kalır. 9 öne koşar, savunma geri döner. | Vuruş sesi |
| **4.6–5.1** | Şut ve gol | Top kalenin sol köşesine gider, file beyaz parlar. | Vuruş + gol sesi |
| **5.4–8.0** | **"GOAL" / "NO GOAL"** butonları | Butonlar sırayla hafifçe nabız atar. Geri sayım yok, izleyiciye yaklaşık 2.5 sn karar süresi. | VO: "Goal or no goal? Your call." |
| **8.0–8.5** | "◀◀ REWIND" | Oyuncular ve top pas anına geri sarılır, renkler soluklaşır. | Whoosh |
| **8.5–9.4** | Beyaz flaş + sarı çerçeve, "PAUSED AT THE PASS" | Karar pas anında verilir. Kesik ok olacak pası gösterir. | VO: "Freeze the pass." |
| **9.5–11.8** | "COUNT THE OPPONENTS FROM THE GOAL LINE" | Hücumcular soluklaşır, dikkat rakiplere çekilir. | VO: "The keeper isn't special. Law 11 counts opponents." |
| **11.9** | **"1 · LAST"** etiketi 4 numarada | Rakipler kale çizgisinden sayılır. | Ding · "Last: the defender on the line." |
| **13.6** | **"2 · SECOND-LAST"** etiketi kalecide | Kalecinin özel bir rolü olmadığı, sadece 2. rakip olduğu görülür. | Ding · "Second-last: the keeper." |
| **14.0–15.0** | **Ofsayt çizgisi** kalecinin hizasında soldan sağa çizilir. Önündeki bölge kırmızıya boyanır. | Çizgi, sondan ikinci rakipten geçer. | Whoosh |
| **15.2** | Kontrol listesi ✓ "In the opponents' half" + "▲ OPPONENTS' HALF" etiketi | Şart 1 | Ding · "He's nearer the goal line…" |
| **16.5** | ✓ "Nearer the goal line than the ball" + kesik "BALL" çizgisi | Şart 2: top, 9'un gerisinde. | Ding · "…than the ball…" |
| **17.2** | ✓ "Nearer than the 2nd-last opponent" + 9 ile çizgi arasında ölçü çubuğu | Şart 3: aynı hizada değil, net bir şekilde önde. | Ding · "…and the second-last opponent." |
| **18.5** | **"OFFSIDE POSITION"** etiketi 9'da | Üç şartın sonucu | VO: "Offside position." |
| **19.8–21.1** | "HE PLAYS THE BALL = OFFSIDE OFFENCE" | Pas yeniden oynatılır, 9 topa dokunur, kırmızı halka çıkar. Pozisyon tek başına ihlal değildir, ihlal topu oynamaktır. | Vuruş · "And he plays the ball." |
| **21.2–22.1** | **"NO GOAL · OFFSIDE"** damgası | Sahne kısa bir sarsıntıyla karar anını vurgular. | Boom · "No goal." |
| **22.2–23.8** | "INDIRECT FREE KICK TO THE DEFENDING TEAM" + "OFFENCE HERE" işareti | Cezanın türü ve ihlalin yeri | VO: "Indirect free kick to the defence." |
| **24.0–28.6** | "THE RULE: BEATING THE KEEPER ISN'T ENOUGH" + mini diyagram | Diyagramda üç şey var: 2 rakip, sondan ikinci rakibin çizgisi, "LEVEL = ONSIDE" ve "OFFSIDE POSITION" örnekleri. | VO: "Beat the keeper? Not enough. You need two opponents…" |
| **28.7–30.0** | **"DID YOU GET IT RIGHT?"** | Yorum çağrısı | VO: "Did you get it right?" |

**Ekran yerleşimi (Shorts güvenli alanı):**
- Başlık bandı: y 56–390
- Saha: y 400–1220
- Altyazı: y 1290–1420
- Alt 500 px YouTube arayüzü için boş bırakıldı.

## 5. Durum ve sonraki adım

- **Video:** Seslendirme **olmadan** render edildi. İçinde altyazı ve ses efektleri var. Ses modeli indirme adımı bu oturumda izin almadığı için TTS üretemedim.
- **Seslendirme nasıl eklenir:** 3. bölümdeki metni ElevenLabs'te ya da kendi sesinle kaydet. Dosyayı `public/vo/offside-past-keeper.wav` olarak koy. `src/data/offside-past-keeper.json` dosyasına `"vo": "vo/offside-past-keeper.wav"` ekle. Gerekirse `cues` ve `events` sürelerini kayda göre kaydır, sonra yeniden render et.

## 6. Yayın paketi (öneri)

- **Başlık:** `He beat the keeper… so why is it OFFSIDE? ⚽ #shorts`
- **Açıklama:** `Goal or no goal? Make your call before the freeze-frame. Rule: IFAB Laws of the Game, Law 11 – Offside: https://www.theifab.com/laws/latest/offside/ (illustration, not a real match).`
- **Sabit yorum:** `Be honest: did you say GOAL? 👇`
