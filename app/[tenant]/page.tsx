import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { notFound } from "next/navigation";

interface PageProps {
  params: {
    tenant: string;
  };
}

export default async function NurseryHomePage({ params }: PageProps) {
  const { tenant } = params;

  // שליפת נתוני המשתלה לפי subdomain והמוצרים שלה
  const nursery = await prisma.nursery.findUnique({
    where: { subdomain: tenant },
    include: {
      nurseryProducts: {
        where: { isActive: true },
        include: {
          plant: true,
          supply: true,
        },
      },
    },
  });

  if (!nursery) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-12" dir="rtl">
      {/* כותרת המשתלה */}
      <header className="max-w-7xl mx-auto mb-10 text-center">
        <h1 className="text-4xl font-bold text-emerald-800 mb-2">
          {nursery.name}
        </h1>
        <p className="text-gray-600">קטלוג צמחים וציוד מעודכן</p>
      </header>

      {/* גריד המוצרים */}
      <section className="max-w-7xl mx-auto">
        {nursery.nurseryProducts.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
            לא נמצאו מוצרים זמינים במשתלה זו.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {nursery.nurseryProducts.map((product) => {
              const itemTitle =
                product.customTitle ||
                product.plant?.hebrewName ||
                product.supply?.title ||
                "מוצר ללא שם";

              const itemDescription =
                product.customDescription ||
                product.plant?.description ||
                product.supply?.description ||
                "";

              const itemImage =
                product.plant?.imageUrl ||
                product.supply?.imageUrl ||
                null;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="h-48 bg-emerald-50 flex items-center justify-center text-emerald-600 text-4xl font-bold">
                    {itemImage ? (
                      <img
                        src={itemImage}
                        alt={itemTitle}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      "🪴"
                    )}
                  </div>
                  <div className="p-4">
                    {product.plant?.plantType && (
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                        {product.plant.plantType}
                      </span>
                    )}
                    <h3 className="text-lg font-bold text-gray-800 mt-2">
                      {itemTitle}
                    </h3>
                    {product.plant?.latinName && (
                      <p className="text-xs text-gray-400 italic mb-2">
                        {product.plant.latinName}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                      {itemDescription}
                    </p>
                    <div className="flex items-center justify-between border-t pt-3">
                      <span className="text-lg font-bold text-gray-900">
                        {formatPrice(product.price.toString())}
                      </span>
                      <button className="bg-emerald-600 text-white text-sm px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-700 transition">
                        פרטים נוספים
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}