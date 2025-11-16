import random

def main():
    

    while True:
        try:
            num_people = int(input("Enter number of decision makers: "))
            if num_people > 0:
                break
            print(f"Please enter a positive number.")
        except ValueError:
            print(f"Please enter a valid number.")

    while True:
        try:
            num_options = int(input("Enter number of options to choose from: "))
            if num_options > 1:
                break
            print("Please enter at least 2 options.")
        except ValueError:
            print("Please enter a valid number.")
            
    options = []
    print("\nEnter the name of each option:")
    for i in range (num_options):
        option =input(f"Option {i+1} ").strip()
        options.append(option)


main()



